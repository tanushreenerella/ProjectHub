// src/components/Home.tsx
import React, { useState, useEffect } from 'react';
import type { User, Project, UserProfile, FundingApplication, Conversation, Message } from '../types/index.ts';
import './Home.css';
import AIProposalAssistant from './AIProposalAssistant';
import TeamFinder from './TeamFinder';
import FundingPortal from './fundingPortal';
import { FundingService } from '../services/fundingService';
import Chat from './Chat';
import { io, Socket } from "socket.io-client";
import Profile from './Profile';
import Projects from './Projects.tsx';
import Notifications from "./Notifications";
import Mentorship from './Mentorship';
import Matchmaking from './Matchmaking';
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
  const isMentor = user.role === 'mentor';

  // Update activeTab to include 'funding' and 'chat'
  const [activeTab, setActiveTab] = useState<
  'dashboard' | 'projects' | 'network' | 'ai' | 'funding' | 'chat' | 'profile' | 'mentorship' | 'matchmaking'
>('dashboard');
  const [chatBadge, setChatBadge] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [, setConnections] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [fundingApplications, setFundingApplications] = useState<FundingApplication[]>([]);
  const [, setLoading] = useState(true);
   const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages] = useState<{ [conversationId: string]: Message[] }>({});
 const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);

  const [currentConversationId, setCurrentConversationId] =
  useState<string | null>(null);

  const [showChatWidget, setShowChatWidget] = useState(false);
  // Add Team Finder state
  useEffect(() => {
  const token = localStorage.getItem("csh_token");
  if (!token) return;

  const s = io(`${import.meta.env.VITE_API_URL}`, {
    query: { token },
    transports: ['polling', 'websocket'],
    upgrade: true,
  });

  setSocket(s);

  s.on("connect", () => {
    console.log("✅ Connected to chat server");
    try {
      s.emit('register', { user_id: user.id });
    } catch (err) {
      console.warn('Failed to emit register on connect', err);
    }
  });

  s.on("receive_message", (data: any) => {
    const senderId = data.sender_id || data.senderId;
    if (senderId !== user.id) {
      setChatBadge(prev => prev + 1);
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

    fetch(`${import.meta.env.VITE_API_URL}/api/projects/my`, {
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
          const connectionsRes = await fetch(`${import.meta.env.VITE_API_URL}/api/users/connections`, {
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
          const requestsRes = await fetch(`${import.meta.env.VITE_API_URL}/api/users/connection-requests`, {
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

  fetch(`${import.meta.env.VITE_API_URL}/api/conversations`, {
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
  const handleOpenNotification = (notification: {
  type: string;
  project_id?: string;
}) => {
  const type = notification.type || "";

  if (type.startsWith("connection_")) {
    setActiveTab("network");
    return;
  }

  if (type.startsWith("project_") || type.startsWith("task_") || type === "member_joined_project") {
    if (isMentor) {
      setActiveTab("mentorship");
    } else {
      if (notification.project_id) {
        localStorage.setItem("projecthub_open_project_id", notification.project_id);
      }
      setActiveTab("projects");
    }
    return;
  }

  if (type === "match_request_received" || type === "match_mutual") {
    setActiveTab("matchmaking");
    return;
  }

  setActiveTab("dashboard");
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
            {isMentor ? (
              <>
                <button 
                  className={`nav-item ${activeTab === 'mentorship' ? 'active' : ''}`}
                  onClick={() => setActiveTab('mentorship')}
                >
                  Mentorship
                </button>
                <button 
                  className={`nav-item ${activeTab === 'network' ? 'active' : ''}`}
                  onClick={() => setActiveTab('network')}
                >
                  Network
                </button>
                <button
                  className={`nav-item ${activeTab === 'matchmaking' ? 'active' : ''}`}
                  onClick={() => setActiveTab('matchmaking')}
                >
                  🔥 Match
                </button>
                <button
                  className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('chat'); setChatBadge(0); }}
                  style={{ position: 'relative' }}
                >
                  💬 Chat
                  {chatBadge > 0 && (
                    <span style={{
                      position: 'absolute', top: '-4px', right: '-4px',
                      background: 'linear-gradient(135deg,#6366f1,#3b82f6)',
                      color: 'white', fontSize: '0.6rem', fontWeight: 700,
                      minWidth: '16px', height: '16px', borderRadius: '999px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 4px'
                    }}>{chatBadge}</span>
                  )}
                </button>
                <button
                  className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  Profile
                </button>
              </>
            ) : (
              <>
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
                  className={`nav-item ${activeTab === 'matchmaking' ? 'active' : ''}`}
                  onClick={() => setActiveTab('matchmaking')}
                >
                  🔥 Match
                </button>
                <button
                  className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('chat'); setChatBadge(0); }}
                  style={{ position: 'relative' }}
                >
                  💬 Chat
                  {chatBadge > 0 && (
                    <span style={{
                      position: 'absolute', top: '-4px', right: '-4px',
                      background: 'linear-gradient(135deg,#6366f1,#3b82f6)',
                      color: 'white', fontSize: '0.6rem', fontWeight: 700,
                      minWidth: '16px', height: '16px', borderRadius: '999px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 4px'
                    }}>{chatBadge}</span>
                  )}
                </button>
                <button
                  className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  Profile
                </button>
                <button
                  className={`nav-item ${activeTab === 'mentorship' ? 'active' : ''}`}
                  onClick={() => setActiveTab('mentorship')}
                >
                  🎓 Mentorship
                </button>
              </>
            )}
          </nav>

         <div className="user-menu">
           <Notifications
             userId={user.id}
             token={localStorage.getItem("csh_token") || ""}
             socket={socket}
             onOpenNotification={handleOpenNotification}
           />

           <div className="user-info">
             <span className="user-name">{user.name}</span>
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
              
              <p>
                {isMentor
                  ? 'Manage your mentoring activity, review requests, and support students.'
                  : `Welcome to your project hub, ${user.name}!`}
              </p>
            </div>

            <div className="stats-cards">
              <div className="stat-card">
                <div className="stat-icon">{isMentor ? '🎓' : '📊'}</div>
                <div className="stat-info">
                  <h3>{isMentor ? chatUsers.length : projects.length}</h3>
                  <p>{isMentor ? 'Students Mentored' : 'Active Projects'}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <h3>{chatUsers.length}</h3>
                  <p>{isMentor ? 'Connections' : 'Connections'}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">{isMentor ? '📝' : '💰'}</div>
                <div className="stat-info">
                  <h3>{isMentor ? 0 : fundingApplications.length}</h3>
                  <p>{isMentor ? 'Pending Requests' : 'Funding Applications'}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⚡</div>
                <div className="stat-info">
                  <h3>{user.skills?.length || 0}</h3>
                  <p>Skills Listed</p>
                </div>
              </div>
            </div>

            <div className="quick-actions">
              <h2>Quick Actions</h2>
              <div className="action-buttons">
                {isMentor ? (
                  <>
                    <button
                      className="action-btn secondary"
                      onClick={() => setActiveTab('mentorship')}
                    >
                      🧑‍🏫 Review Mentorship Requests
                    </button>
                    <button
                      className="action-btn secondary"
                      onClick={() => setActiveTab('network')}
                    >
                      👥 Manage Connections
                    </button>
                    <button
                      className="action-btn secondary"
                      onClick={() => setActiveTab('matchmaking')}
                    >
                      🔥 Find Students to Mentor
                    </button>
                    <button
                      className="action-btn secondary"
                      onClick={() => setActiveTab('profile')}
                    >
                      👤 Edit My Profile
                    </button>
                  </>
                ) : (
                  <>
                  <button 
                      className="action-btn secondary"
                      onClick={() => setActiveTab('projects')}
                    >
                      📁 View My Projects
                    </button>
                    <button 
                      className="action-btn secondary"
                      onClick={() => setActiveTab('ai')}
                    >
                      🤖 Assistance
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
                   <button 
                      className="action-btn secondary"
                      onClick={() => setActiveTab('mentorship')}
                    >
                      🧑‍🏫 Mentorship
                    </button></>
                )}
              </div>
            </div>

            {!isMentor && (
              <div className="journey-section">
                <h2 className="journey-title">Your Startup Journey</h2>
                <div className="journey-steps">
                  <div className={`journey-step ${projects.length > 0 ? 'completed' : 'active'}`}>
                    <div className="journey-step-num">01</div>
                    <div className="journey-step-icon">🚀</div>
                    <h3>Create a Project</h3>
                    <p>Submit your idea and get instant AI feedback on market fit</p>
                    <button className="journey-btn" onClick={() => setActiveTab('projects')}>
                      {projects.length > 0 ? '✓ View Projects' : 'Get Started →'}
                    </button>
                  </div>
                  <div className={`journey-step ${chatUsers.length > 0 ? 'completed' : ''}`}>
                    <div className="journey-step-num">02</div>
                    <div className="journey-step-icon">🤝</div>
                    <h3>Find Your Team</h3>
                    <p>Connect with co-founders, developers, and designers</p>
                    <button className="journey-btn" onClick={() => setActiveTab('network')}>
                      {chatUsers.length > 0 ? '✓ View Network' : 'Find Team →'}
                    </button>
                  </div>
                  <div className="journey-step">
                    <div className="journey-step-num">03</div>
                    <div className="journey-step-icon">🎓</div>
                    <h3>Get Mentored</h3>
                    <p>Request guidance from experienced startup mentors</p>
                    <button className="journey-btn" onClick={() => setActiveTab('mentorship')}>
                      Find Mentor →
                    </button>
                  </div>
                  <div className={`journey-step ${fundingApplications.length > 0 ? 'completed' : ''}`}>
                    <div className="journey-step-num">04</div>
                    <div className="journey-step-icon">💰</div>
                    <h3>Apply for Funding</h3>
                    <p>Explore grants and funding opportunities for your startup</p>
                    <button className="journey-btn" onClick={() => setActiveTab('funding')}>
                      {fundingApplications.length > 0 ? '✓ View Applications' : 'Explore →'}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
{activeTab === 'mentorship' && (
  <Mentorship userRole={user.role} />
)}

{activeTab === 'matchmaking' && (
  <Matchmaking userId={user.id} userRole={user.role} />
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