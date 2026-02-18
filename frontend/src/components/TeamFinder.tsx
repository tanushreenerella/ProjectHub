// src/components/TeamFinder.tsx
import { useState, useEffect } from 'react';
import type { User, UserProfile, TeamSearchFilters } from '../types';
import './TeamFinder.css';

interface TeamFinderProps {
  currentUser: User;
  onSendConnection: (toUserId: string, message: string) => void;
}

interface ConnectionState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

const TeamFinder: React.FC<TeamFinderProps> = ({ currentUser, onSendConnection }) => {
  const [filters, setFilters] = useState<TeamSearchFilters>({
    skills: [],
    interests: [],
    role: '',
    availability: 'flexible'
  });
  const [users, setUsers] = useState<UserProfile[]>([]);
const [loading,setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    loading: false,
    error: null,
    success: null
  });

  // All available skills and interests for filtering
  const availableSkills = ['React', 'Node.js', 'Python', 'UI/UX', 'Marketing', 'Finance', 'TypeScript', 'MongoDB', 'SQL', 'Java'];
  const availableInterests = ['AI', 'Sustainability', 'Education', 'Healthcare', 'E-commerce', 'FinTech', 'ClimaTech'];

  // Enhanced filter users with EXACT skill matching
  const filteredUsers = users.filter(user => {
    if (user.id === currentUser.id) return false;
    
    // Search by name or any skill
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Filter by selected skills (must have AT LEAST ONE selected skill)
    const matchesSkills = filters.skills.length === 0 || 
                         filters.skills.some(skill => 
                           user.skills.some(userSkill => 
                             userSkill.toLowerCase() === skill.toLowerCase()
                           )
                         );
    
    // Filter by selected interests
    const matchesInterests = filters.interests.length === 0 ||
                           filters.interests.some(interest => 
                             user.interests.some(userInterest => 
                               userInterest.toLowerCase() === interest.toLowerCase()
                             )
                           );
    
    // Filter by role
    const matchesRole = !filters.role || user.role === filters.role;
    
    return matchesSearch && matchesSkills && matchesInterests && matchesRole;
  });

  const handleSendConnection = async (userId: string) => {
    if (!connectionMessage.trim()) {
      setConnectionState({
        loading: false,
        error: 'Please add a message to your connection request',
        success: null
      });
      return;
    }

    setConnectionState({ loading: true, error: null, success: null });
    
    try {
      const token = localStorage.getItem("csh_token");
      const response = await fetch("http://127.0.0.1:5000/api/users/send-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          to_user_id: userId,
          message: connectionMessage
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send connection request');
      }

      setConnectionState({
        loading: false,
        error: null,
        success: `Connection request sent to ${selectedUser?.name}!`
      });

      // Call the parent handler
      onSendConnection(userId, connectionMessage);
      
      // Reset form
      setTimeout(() => {
        setConnectionMessage('');
        setSelectedUser(null);
        setConnectionState({ loading: false, error: null, success: null });
      }, 2000);
      
    } catch (err: any) {
      setConnectionState({
        loading: false,
        error: err.message || 'Error sending connection request',
        success: null
      });
    }
  };
  
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const token = localStorage.getItem("csh_token");
        console.log("TOKEN BEING SENT:", token);
        const res = await fetch("http://127.0.0.1:5000/api/users/match", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await res.json();

        // convert backend response to UI format
        const formatted = data.matches.map((u: any) => ({
          id: u.user_id || u.id,
          name: u.name || "Unknown User",
          role: u.role || "student",
          skills: u.skills || [],
          interests: u.interests || [],
          projects: u.projects || [],
          connections: u.connections || [],
          bio: u.bio || "",
          email: u.email || ""
        }));

        setUsers(formatted);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching matches:", err);
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  return (
    <div className="team-finder">
      <div className="team-finder-header">
        <h1>Find Your Dream Team</h1>
        <p>Connect with talented students and mentors to build your startup</p>
      </div>

      <div className="team-finder-content">
        {/* Search and Filters Sidebar */}
        <div className="filters-sidebar">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by name or skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-section">
            <h3>🔧 Filter by Skills</h3>
            <p className="filter-hint">Select one or more skills</p>
            <div className="filter-tags">
              {availableSkills.map(skill => (
                <button
                  key={skill}
                  className={`filter-tag ${filters.skills.includes(skill) ? 'active' : ''}`}
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    skills: prev.skills.includes(skill) 
                      ? prev.skills.filter(s => s !== skill)
                      : [...prev.skills, skill]
                  }))}
                  title={`Click to ${filters.skills.includes(skill) ? 'remove' : 'add'} ${skill}`}
                >
                  {skill}
                </button>
              ))}
            </div>
            {filters.skills.length > 0 && (
              <p className="filter-count">Selected: {filters.skills.length} skill{filters.skills.length !== 1 ? 's' : ''}</p>
            )}
          </div>

          <div className="filter-section">
            <h3>💡 Filter by Interests</h3>
            <p className="filter-hint">Select one or more interests</p>
            <div className="filter-tags">
              {availableInterests.map(interest => (
                <button
                  key={interest}
                  className={`filter-tag ${filters.interests.includes(interest) ? 'active' : ''}`}
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    interests: prev.interests.includes(interest)
                      ? prev.interests.filter(i => i !== interest)
                      : [...prev.interests, interest]
                  }))}
                  title={`Click to ${filters.interests.includes(interest) ? 'remove' : 'add'} ${interest}`}
                >
                  {interest}
                </button>
              ))}
            </div>
            {filters.interests.length > 0 && (
              <p className="filter-count">Selected: {filters.interests.length} interest{filters.interests.length !== 1 ? 's' : ''}</p>
            )}
          </div>

          <div className="filter-section">
            <h3>👔 Filter by Role</h3>
            <select 
              value={filters.role}
              onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
              className="role-select"
            >
              <option value="">Any Role</option>
              <option value="student">Student</option>
              <option value="mentor">Mentor</option>
              <option value="developer">Developer</option>
              <option value="designer">Designer</option>
              <option value="marketing">Marketing</option>
              <option value="business">Business</option>
            </select>
          </div>

          {(filters.skills.length > 0 || filters.interests.length > 0 || filters.role) && (
            <button 
              className="clear-filters-btn"
              onClick={() => setFilters({ skills: [], interests: [], role: '', availability: 'flexible' })}
            >
              Clear All Filters
            </button>
          )}
        </div>

        {/* Users Grid */}
        <div className="users-grid">
          {loading ? (
            <div className="loading-state">
              <p>Loading team members...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="no-users">
              <h3>No users found</h3>
              <p>Try adjusting your search filters</p>
            </div>
          ) : (
            filteredUsers.map(user => (
              <div key={user.id} className="user-card">
                <div className="user-header">
                  <div className="user-avatar">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-info">
                    <h3>{user.name}</h3>
                    <span className="user-role">👤 {user.role}</span>
                  </div>
                </div>

                {user.bio && (
                  <div className="user-bio">
                    <p>{user.bio.substring(0, 100)}{user.bio.length > 100 ? '...' : ''}</p>
                  </div>
                )}

                <div className="user-skills">
                  <h4>🔧 Skills ({user.skills.length})</h4>
                  <div className="skill-tags">
                    {user.skills.slice(0, 4).map(skill => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                    {user.skills.length > 4 && (
                      <span className="skill-more">+{user.skills.length - 4} more</span>
                    )}
                  </div>
                </div>

                <div className="user-interests">
                  <h4>💡 Interests ({user.interests.length})</h4>
                  <div className="interest-tags">
                    {user.interests.slice(0, 3).map(interest => (
                      <span key={interest} className="interest-tag">{interest}</span>
                    ))}
                  </div>
                </div>

                <div className="user-stats">
                  <div className="stat">
                    <strong>{user.projects?.length || 0}</strong>
                    <span>Projects</span>
                  </div>
                  <div className="stat">
                    <strong>{user.connections?.length || 0}</strong>
                    <span>Connections</span>
                  </div>
                </div>

                <button 
                  className="connect-btn"
                  onClick={() => setSelectedUser(user)}
                  title={`Send connection request to ${user.name}`}
                >
                  🤝 Connect with {user.name.split(' ')[0]}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Connection Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => !connectionState.loading && setSelectedUser(null)}>
          <div className="connection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-user-info">
                <div className="modal-avatar">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2>Connect with {selectedUser.name}</h2>
                  <p className="modal-role">{selectedUser.role} • {selectedUser.skills.length} skills</p>
                </div>
              </div>
              <button 
                className="close-btn"
                onClick={() => !connectionState.loading && setSelectedUser(null)}
                disabled={connectionState.loading}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              {/* User Preview */}
              <div className="user-preview">
                <div className="preview-section">
                  <h4>Skills</h4>
                  <div className="skill-tags">
                    {selectedUser.skills.map(skill => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                </div>
                <div className="preview-section">
                  <h4>Interests</h4>
                  <div className="interest-tags">
                    {selectedUser.interests.map(interest => (
                      <span key={interest} className="interest-tag">{interest}</span>
                    ))}
                  </div>
                </div>
              </div>

              <p className="connection-description">Send a personalized connection request to start collaborating</p>
              
              {/* Error Message */}
              {connectionState.error && (
                <div className="alert alert-error">
                  ⚠️ {connectionState.error}
                </div>
              )}

              {/* Success Message */}
              {connectionState.success && (
                <div className="alert alert-success">
                  ✅ {connectionState.success}
                </div>
              )}
              
              <div className="message-input">
                <label htmlFor="connection-message">Message (required)</label>
                <textarea
                  id="connection-message"
                  value={connectionMessage}
                  onChange={(e) => setConnectionMessage(e.target.value)}
                  placeholder="Hi! I'd love to connect and discuss potential collaboration. I'm interested in working together on projects related to..."
                  rows={5}
                  disabled={connectionState.loading}
                  maxLength={500}
                  required
                />
                <p className="char-count">{connectionMessage.length}/500 characters</p>
              </div>

              <div className="modal-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => setSelectedUser(null)}
                  disabled={connectionState.loading}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => handleSendConnection(selectedUser.id)}
                  disabled={connectionState.loading || !connectionMessage.trim()}
                >
                  {connectionState.loading ? '⏳ Sending...' : '🤝 Send Connection Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamFinder;