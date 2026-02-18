// src/components/Chat.tsx
import { useState, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import type { User } from '../types';
import './Chat.css';

interface ChatUser {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: string[];
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount?: number;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
}

interface ChatProps {
  currentUser: User;
  socket: Socket | null;
}

const Chat: React.FC<ChatProps> = ({ currentUser, socket }) => {
  const [conversations, setConversations] = useState<ChatUser[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatUser | null>(null);
  // messagesMap stores messages per conversation id
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]); // messages for currently selected conv
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  console.log('[Chat] component mounted/updated with socket:', socket ? '✅ present' : '❌ null');

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch  and pending requests on mount
  useEffect(() => {
    const fetchChatUsers = async () => {
      try {
        const token = localStorage.getItem('csh_token');
        if (!token) {
          console.error('No token found');
          return;
        }

        // Get 
        console.log('Fetching connections...');
        const connectionsRes = await fetch('http://127.0.0.1:5000/api/users/connections', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!connectionsRes.ok) {
          console.error('Connections response not ok:', connectionsRes.status);
        }
        
        const connectionsData = await connectionsRes.json();
        console.log('Connections response:', connectionsData);
        const connectedUsers = connectionsData.connections || [];

        // Get pending connection requests (both sent and received)
        console.log('Fetching connection requests...');
        const requestsRes = await fetch('http://127.0.0.1:5000/api/users/connection-requests', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!requestsRes.ok) {
          console.error('Requests response not ok:', requestsRes.status);
        }
        
        const requestsData = await requestsRes.json();
        console.log('Connection requests response:', requestsData);
        const requestUsers = (requestsData.requests || []).map((req: any) => ({
          id: req.other_user_id,
          name: req.from_user_name,
          email: req.from_user_email,
          role: req.from_user_role,
          skills: req.from_user_skills || [],
        }));

        // Combine and remove duplicates
        const allUsers = [...connectedUsers, ...requestUsers];
        const uniqueUsers = Array.from(
          new Map(allUsers.map((u: ChatUser) => [u.id, u])).values()
        );

        console.log('Final unique users:', uniqueUsers);
        const enriched = uniqueUsers.map((u: any) => ({
          id: u.id,
          name: u.name || u.full_name || u.displayName || 'Unknown',
          email: u.email || '',
          role: u.role || '',
          skills: u.skills || [],
          lastMessage: u.lastMessage || undefined,
          lastMessageTime: u.lastMessageTime ? new Date(u.lastMessageTime) : undefined,
          unreadCount: u.unreadCount || 0,
        }));
        setConversations(enriched);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching chat users:', err);
        setLoading(false);
      }
    };

    fetchChatUsers();
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) {
      console.warn('[Chat] Socket not available');
      return;
    }

    const handleReceiveMessage = (data: any) => {
      console.log('[Chat] 🔔 handleReceiveMessage called with:', data);
      const convId: string = data.conversation_id || data.conversationId;
      const messageId = data.id;
      
      // Deduplicate by message ID: if we already have this ID in messagesMap, skip
      setMessagesMap((prev) => {
        const existingMessages = prev[convId] || [];
        const isDuplicate = existingMessages.some(m => m.id === messageId);
        
        if (isDuplicate) {
          console.log('[Chat] ⚠️ message ID already exists, skipping duplicate:', messageId);
          return prev;
        }
        
        const newMessage: ChatMessage = {
          id: messageId,
          conversationId: convId,
          senderId: data.sender_id || data.senderId,
          senderName: data.sender_name || data.senderName || 'Unknown',
          text: data.text,
          timestamp: new Date(data.timestamp || Date.now()),
        };

        console.log('[Chat] appending message to messagesMap for convId:', convId);
        const copy = { ...prev };
        if (!copy[convId]) copy[convId] = [];
        copy[convId] = [...copy[convId], newMessage];
        console.log('[Chat] messagesMap updated, convId:', convId, 'message count:', copy[convId].length);
        return copy;
      });

      // If this conversation is currently open, update visible messages
      const currentConvId = selectedConversation
        ? [currentUser.id, selectedConversation.id].sort().join('-')
        : null;

      console.log('[Chat] currentConvId:', currentConvId, 'incomingConvId:', convId, 'match:', currentConvId === convId);

      if (currentConvId === convId) {
        console.log('[Chat] ✅ conversation is open, updating visible messages');
        setMessages((prev) => {
          // Also check in visible messages to prevent duplicates there
          const isDuplicate = prev.some(m => m.id === messageId);
          if (isDuplicate) {
            console.log('[Chat] ⚠️ duplicate in visible messages, skipping');
            return prev;
          }
          
          const newMessage: ChatMessage = {
            id: messageId,
            conversationId: convId,
            senderId: data.sender_id || data.senderId,
            senderName: data.sender_name || data.senderName || 'Unknown',
            text: data.text,
            timestamp: new Date(data.timestamp || Date.now()),
          };
          return [...prev, newMessage];
        });
      } else {
        console.log('[Chat] conversation not open, incrementing unread');
        // increment unreadCount for corresponding conversation (other participant)
        setConversations((prev) =>
          prev.map((conv) => {
            const otherId = conv.id;
            // conversation id for this pair
            const id1 = [currentUser.id, otherId].sort().join('-');
            if (id1 === convId) {
              return { ...conv, unreadCount: (conv.unreadCount || 0) + 1, lastMessage: data.text, lastMessageTime: new Date(data.timestamp || Date.now()) };
            }
            return conv;
          })
        );
      }

      // update last message/time on conversation list for sender/recipient
      setConversations((prev) =>
        prev.map((conv) =>
          ([currentUser.id, conv.id].sort().join('-') === convId)
            ? { ...conv, lastMessage: data.text, lastMessageTime: new Date(data.timestamp || Date.now()) }
            : conv
        )
      );
    };

    const handleConversationHistory = (data: any) => {
      console.log('[Chat] 📜 handleConversationHistory called with:', data);
      const convId: string = data.conversation_id || data.conversationId;
      const messagesData = (data.messages || []).map((m: any) => ({
        id: m.id || (crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())),
        conversationId: convId,
        senderId: m.sender_id || m.senderId,
        senderName: m.sender_name || m.senderName || 'Unknown',
        text: m.text,
        timestamp: new Date(m.timestamp),
      }));

      console.log('[Chat] loaded', messagesData.length, 'messages for convId:', convId);
      setMessagesMap((prev) => ({ ...prev, [convId]: messagesData }));

      const currentConvId = selectedConversation
        ? [currentUser.id, selectedConversation.id].sort().join('-')
        : null;

      if (currentConvId === convId) {
        console.log('[Chat] ✅ loaded conversation is open, showing messages');
        setMessages(messagesData);
        // clear unread for this conversation
        setConversations((prev) => prev.map((c) => {
          const cid = [currentUser.id, c.id].sort().join('-');
          if (cid === convId) return { ...c, unreadCount: 0 };
          return c;
        }));
      }

      // update last message/time on conversation list
      if (messagesData.length > 0) {
        const last = messagesData[messagesData.length - 1];
        setConversations((prev) =>
          prev.map((conv) =>
            ([currentUser.id, conv.id].sort().join('-') === convId)
              ? { ...conv, lastMessage: last.text, lastMessageTime: last.timestamp }
              : conv
          )
        );
      }
    };

    console.log('[Chat] mounting socket listeners');
    socket.on('receive_message', handleReceiveMessage);
    socket.on('conversation_history', handleConversationHistory);

    return () => {
      console.log('[Chat] unmounting socket listeners');
      socket.off('receive_message', handleReceiveMessage);
      socket.off('conversation_history', handleConversationHistory);
    };
  }, [socket, selectedConversation, currentUser]);

  // Conversation load is triggered when user selects a conversation (to avoid duplicate emits).

  // Send message
  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation || !socket) {
      console.warn('[Chat] handleSendMessage blocked:', { hasInput: !!messageInput.trim(), hasConv: !!selectedConversation, hasSocket: !!socket });
      return;
    }

    setSending(true);

    const payload = {
      user1_id: currentUser.id,
      user2_id: selectedConversation.id,
      text: messageInput,
      sender_name: currentUser.name,
    };
    console.log('[Chat] emitting send_message:', payload);
    socket.emit('send_message', payload);

    // Clear input immediately but DON'T add message locally
    // Let the server confirmation via receive_message be the source of truth
    // This prevents duplicates when the server broadcasts back to us
    setMessageInput('');
    setSending(false);
  };

  // Format time
  const formatTime = (date: Date) => {
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Format date
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    }
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return d.toLocaleDateString();
  };

  return (
    <div className="chat-container">
      <div className="chat-layout">
        {/* Conversations List */}
        <div className="conversations-sidebar">
          <div className="sidebar-header">
            <h2>💬 Messages</h2>
            <span className="conversation-count">{conversations.length}</span>
          </div>

          <div className="conversations-list">
            {loading ? (
              <div className="loading-conversations">
                <p>Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="no-conversations">
                <p>No conversations yet</p>
                <small>Send a connection request to start chatting!</small>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`conversation-item ${
                    selectedConversation?.id === conv.id ? 'active' : ''
                  }`}
                  onClick={() => {
                    const convId = [currentUser.id, conv.id].sort().join('-');
                    setSelectedConversation(conv);
                    // clear unread immediately for UI
                    setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, unreadCount: 0 } : c));

                    // if we already have messages for this conv, show them
                    if (messagesMap[convId]) {
                      setMessages(messagesMap[convId]);
                      return;
                    }

                    // If socket is connected, request history now; otherwise wait for connect
                    if (socket) {
                      try {
                        // @ts-ignore socket.connected exists on Socket
                        if ((socket as any).connected) {
                          socket.emit('load_conversation', { user1_id: currentUser.id, user2_id: conv.id });
                        } else {
                          const onConnect = () => {
                            socket.emit('load_conversation', { user1_id: currentUser.id, user2_id: conv.id });
                            socket.off('connect', onConnect);
                          };
                          socket.on('connect', onConnect);
                        }
                      } catch (err) {
                        console.warn('Socket emit failed, will try once connected', err);
                      }
                    }
                  }}
                >
                  <div className="conversation-avatar">
                    {conv.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="conversation-info">
                    <h4>{conv.name}</h4>
                    <p className="conversation-preview">
                      {conv.lastMessage
                        ? conv.lastMessage.substring(0, 50) +
                          (conv.lastMessage.length > 50 ? '...' : '')
                        : 'No messages yet'}
                    </p>
                  </div>
                  {conv.unreadCount ? (
                    <div className="conversation-unread">{conv.unreadCount}</div>
                  ) : null}
                  {conv.lastMessageTime && (
                    <div className="conversation-time">
                      {formatTime(new Date(conv.lastMessageTime))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="chat-window">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <div className="chat-header-info">
                  <div className="chat-header-avatar">
                    {selectedConversation.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3>{selectedConversation.name}</h3>
                    <p className="chat-header-role">
                      {selectedConversation.role} •{' '}
                      {selectedConversation.skills.length} skills
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="messages-area">
                {messages.length === 0 ? (
                  <div className="no-messages">
                    <div className="no-messages-icon">💬</div>
                    <p>Start a conversation with {selectedConversation.name}</p>
                    <small>Messages are end-to-end and real-time</small>
                  </div>
                ) : (
                  <div className="messages-list">
                    {messages.map((msg, idx) => {
                      const isCurrentUser = msg.senderId === currentUser.id;
                      const showTimestamp =
                        idx === 0 ||
                        new Date(messages[idx - 1].timestamp).toDateString() !==
                          new Date(msg.timestamp).toDateString();

                      return (
                        <div key={msg.id}>
                          {showTimestamp && (
                            <div className="message-date-divider">
                              {formatDate(msg.timestamp)}
                            </div>
                          )}
                          <div
                            className={`message ${
                              isCurrentUser ? 'sent' : 'received'
                            }`}
                          >
                            {!isCurrentUser && (
                              <div className="message-avatar">
                                {selectedConversation.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="message-content">
                              <div className="message-text">{msg.text}</div>
                              <div className="message-time">
                                {formatTime(msg.timestamp)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="chat-input-area">
                <div className="input-field">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    disabled={sending}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sending}
                    className="send-btn"
                  >
                    {sending ? '⏳' : '📤'}
                  </button>
                </div>
                <small className="input-hint">Press Enter to send</small>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <div className="no-selection-icon">💬</div>
              <p>Select a conversation to start messaging</p>
              <small>Your connections will appear in the list</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
