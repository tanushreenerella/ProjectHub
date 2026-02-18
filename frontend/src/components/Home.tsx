// src/components/Home.tsx
import { useState } from 'react';
import type { User, Project, UserProfile, FundingApplication, Conversation, Message } from '../types/index.ts';
import './Home.css';
import AIProposalAssistant from './AIProposalAssistant';
import TeamFinder from './TeamFinder';
import FundingPortal from './fundingPortal';
import { FundingService } from '../services/fundingService';
import Chat from './Chat';
import { io, Socket } from "socket.io-client";
import { useEffect } from "react";
import Profile from './Profile';
import Projects from './Projects.tsx';
interface HomeProps {
  user: User;
  onLogout: () => void;
}

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

const Home: React.FC<HomeProps> = ({ user, onLogout }) => {
  // Update activeTab to include 'funding' and 'chat'
  const [activeTab, setActiveTab] = useState<
  'dashboard' | 'projects' | 'network' | 'ai' | 'funding' | 'chat' | 'profile'
>('dashboard');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connections, setConnections] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [fundingApplications, setFundingApplications] = useState<FundingApplication[]>([]);
  const [loading, setLoading] = useState(true);
   const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<{ [conversationId: string]: Message[] }>({});
 const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);

  const [currentConversationId, setCurrentConversationId] =
  useState<string | null>(null);

  const [showChatWidget, setShowChatWidget] = useState(false);
  // Add Team Finder state
  useEffect(() => {
  const token = localStorage.getItem("csh_token");
  if (!token) return;

  const s = io("http://localhost:5000", {
    query: { token }
  });

  setSocket(s);

  s.on("connect", () => {
    console.log("✅ Connected to chat server");
    // register this socket to a personal room for this user so server can push notifications
    try {
      s.emit('register', { user_id: user.id });
    } catch (err) {
      console.warn('Failed to emit register on connect', err);
    }
  });

  return () => {
    s.disconnect();
  };
}, []);
useEffect(() => {
    const token = localStorage.getItem("csh_token");
    if (!token) return;
    // load my funding applications for dashboard count
    (async () => {
      try {
        const apps = await FundingService.getMyApplications(user.id);
        setFundingApplications(apps || []);
      } catch (err) {
        console.warn('Failed to load funding applications for dashboard', err);
      }
    })();

    fetch("http://127.0.0.1:5000/api/projects/my", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setProjects(data.projects || []);
        setLoading(false);
      });
  }, []);
  // Mock users data for Team Finder
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
         setConnections(connectedUsers);
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
         setChatUsers(enriched);

          setLoading(false);
        } catch (err) {
          console.error('Error fetching chat users:', err);
          setLoading(false);
        }
      };
  
      fetchChatUsers();
    }, []);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([
    {
      id: '2',
      name: 'Alex Chen',
      email: 'alex@college.edu',
      password: '',
      role: 'student',
      skills: ['React', 'Node.js', 'TypeScript'],
      interests: ['AI', 'Education Tech'],
      lookingFor: ['developer'],
      bio: 'Full-stack developer passionate about edtech',
      projects: ['1', '3'],
      connections: ['1'],
      pendingRequests: [],
      createdAt: new Date()
    },
    {
      id: '3', 
      name: 'Sarah Johnson',
      email: 'sarah@college.edu',
      password: '',
      role: 'student',
      skills: ['UI/UX Design', 'Figma', 'Product Management'],
      interests: ['Sustainability', 'Design'],
      lookingFor: ['designer'],
      bio: 'Product designer focused on sustainable solutions',
      projects: ['2'],
      connections: [],
      pendingRequests: [],
      createdAt: new Date()
    },
    {
      id: '4',
      name: 'Dr. Michael Brown',
      email: 'm.brown@college.edu',
      password: '',
      role: 'mentor',
      skills: ['Business Strategy', 'Funding', 'Startup Advisory'],
      interests: ['AI', 'Healthcare'],
      lookingFor: ['mentor'],
      bio: 'Experienced startup mentor and investor',
      projects: [],
      connections: ['1', '2'],
      pendingRequests: [],
      createdAt: new Date()
    }
  ]);
useEffect(() => {
  const token = localStorage.getItem("csh_token");
  if (!token) {
    console.warn("No token yet, skipping conversations fetch");
    return;
  }

  fetch("http://localhost:5000/api/conversations", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
    .then(res => {
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    })
    .then(data => setConversations(data.conversations))
    .catch(err => console.error("Conversation fetch failed:", err));
}, []);



  // Chat State
 

  // Updated connection handler function to create and open chat
  const handleSendConnection = (toUserId: string, message: string) => {
    // In real app, this would call your backend
     if (!socket) return;
    socket?.emit("start_conversation", {
      user1_id: user.id,
      user2_id: toUserId
    });
    
    const targetUser = allUsers.find(u => u.id === toUserId);
    console.log(`Connection request sent to ${targetUser?.name} with message: "${message}"`);
    
    // Update the user's pending requests in state
    setAllUsers(prev => prev.map(u => 
      u.id === toUserId 
        ? { ...u, pendingRequests: [...u.pendingRequests, user.id] }
        : u
    ));
  };
useEffect(() => {
  if (!socket) return;

  const handleConversationStarted = (data: any) => {
    setCurrentConversationId(data.conversation_id);
    setShowChatWidget(true);
  };

  socket.on("conversation_started", handleConversationStarted);

  return () => {
    socket.off("conversation_started", handleConversationStarted);
  };
}, [socket]);

  // Add handler for funding application submission
  const handleApplicationSubmit = (application: FundingApplication) => {
    setFundingApplications(prev => [...prev, application]);
    // You could also show a success message or notification here
    console.log('Funding application submitted:', application);
  };

  // Chat functions
  const handleSendMessage = (conversationId: string, text: string) => {
    if (!socket) return;

    // Support both the conversation_id-only payload and the user-based payload.
    // If conversationId looks like "idA-idB" we can derive participants.
    const parts = (conversationId || '').split('-');
    if (parts.length === 2) {
      const [a, b] = parts;
      // pick current user as sender if matches
      const sender = user.id;
      const recipient = a === sender ? b : b === sender ? a : (parts[1]);

      socket.emit('send_message', {
        user1_id: sender,
        user2_id: recipient,
        text,
        sender_name: user.name,
      });
    } else {
      // fallback: emit raw conversation_id payload (server also supports it)
      socket.emit('send_message', { conversation_id: conversationId, text, sender_name: user.name });
    }
};


  const handleCloseChat = () => {
    setShowChatWidget(false);
    setCurrentConversationId(null);
  };

  return (
    <div className="home-container">
      {/* Header */}
      <header className="home-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🎓</span>
            <span className="logo-text">projectHub</span>
          </div>
          
          <nav className="main-nav">
            <button 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button 
              className={`nav-item ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveTab('projects')}
            >
              My Projects
            </button>
            <button 
              className={`nav-item ${activeTab === 'network' ? 'active' : ''}`}
              onClick={() => setActiveTab('network')}
            >
              Network
            </button>
            <button 
              className={`nav-item ${activeTab === 'funding' ? 'active' : ''}`}
              onClick={() => setActiveTab('funding')}
            >
              💰 Funding
            </button>
            <button 
              className={`nav-item ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              🤖 AI Assistant
            </button>
            <button 
              className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              💬 Chat
            </button>
            <button 
  className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
  onClick={() => setActiveTab('profile')}
>
  👤 Profile
</button>

          </nav>

          <div className="user-menu">
            <div className="user-info">
              <span className="user-name">Welcome, {user.name}</span>
              <span className="user-role">{user.role}</span>
            </div>
            <button onClick={onLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="home-main">
        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <div className="dashboard-header">
              <h1>Dashboard</h1>
              <p>Welcome to your project hub, {user.name}!</p>
            </div>

            <div className="stats-cards">
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-info">
                 <h3>{projects.length}</h3>
                  <p>Active Projects</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <h3>{chatUsers.length}</h3>
                  <p>Connections</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <h3>{fundingApplications.length}</h3>
                  <p>Funding Applications</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🤖</div>
                <div className="stat-info">
                  <h3>12</h3>
                  <p>AI Analyses</p>
                </div>
              </div>
            </div>

            <div className="quick-actions">
              <h2>Quick Actions</h2>
              <div className="action-buttons">
               
                <button 
                  className="action-btn secondary"
                  onClick={() => setActiveTab('ai')}
                >
                  🤖 AI Proposal Assistant
                </button>
                <button 
                  className="action-btn secondary"
                  onClick={() => setActiveTab('network')}
                >
                  👥 Find Team Members
                </button>
                <button 
                  className="action-btn secondary"
                  onClick={() => setActiveTab('funding')}
                >
                  💼 Apply for Funding
                </button>
              </div>
            </div>

            </div>
        )}
        {activeTab === 'projects' && (
  <Projects />
)}

        {activeTab === 'network' && (
          <TeamFinder 
            currentUser={user}
            onSendConnection={handleSendConnection}
          />
        )}

        {/* Add Funding Tab */}
        {activeTab === 'funding' && (
          <div className="funding-tab">
            <FundingPortal 
              user={user}
              onApplicationSubmit={handleApplicationSubmit}
            />
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="ai-tab">
            <div className="tab-header">
              <h1>AI Proposal Assistant</h1>
              <p>Get instant feedback and improvements for your startup ideas</p>
            </div>
            <AIProposalAssistant />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="chat-tab">
            <Chat currentUser={user} socket={socket} />
          </div>
        )}

   {activeTab === 'profile' && (
  <Profile user={user} />
)}


      </main>

      {/* Chat Widget */}
      {showChatWidget && currentConversationId && (
        <div className="chat-widget">
          <div className="chat-header">
            <div className="chat-user-info">
              {(() => {
                const conversation = conversations.find(c => c.id === currentConversationId);
                const otherUserId = conversation?.participants.find(id => id !== user.id);
                const otherUser = allUsers.find(u => u.id === otherUserId);
                return (
                  <>
                    <div className="user-avatar">{otherUser?.name?.charAt(0)}</div>
                    <div className="user-details">
                      <div className="user-name">{otherUser?.name}</div>
                      <div className="user-status">Online</div>
                    </div>
                  </>
                );
              })()}
            </div>
            <button className="close-chat" onClick={handleCloseChat}>×</button>
          </div>
          
          <div className="chat-messages">
            {messages[currentConversationId]?.map(message => (
              <div 
                key={message.id} 
                className={`message ${message.senderId === user.id ? 'sent' : 'received'}`}
              >
                <div className="message-content">
                  {message.text}
                </div>
                <div className="message-time">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
          
          <div className="chat-input">
            <input 
              type="text" 
              placeholder="Type a message..." 
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  handleSendMessage(currentConversationId, e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
            />
            <button 
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                if (input.value.trim()) {
                  handleSendMessage(currentConversationId, input.value);
                  input.value = '';
                }
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      
    </div>
  );
};

export default Home;