import { useState, useEffect } from 'react';
import axios from 'axios';
import './Matchmaking.css';

interface FeedItem {
  id: string;
  name?: string;
  role?: string;
  bio?: string;
  skills?: string[];
  interests?: string[];
  title?: string;
  description?: string;
  category?: string;
  stage?: string;
  skills_required?: string[];
  team_size?: number;
  score: number;
}

interface MatchmakingProps {
  userId: string;
}

type FeedType = 'teammates' | 'projects' | 'mentors' | 'mutual';

const scoreColor = (s: number) => s >= 70 ? '#22c55e' : s >= 40 ? '#f59e0b' : '#ef4444';

const TAB_LABELS: Record<FeedType, string> = {
  teammates: '👥 Teammates',
  projects: '🚀 Projects',
  mentors: '🎓 Mentors',
  mutual: '❤️ My Matches',
};

const Pill = ({ label, type }: { label: string; type: 'skill' | 'interest' }) => (
  <span className={`pill ${type}`}>{label}</span>
);

const Matchmaking: React.FC<MatchmakingProps> = ({ userId: _userId }) => {
  const [feedType, setFeedType] = useState<FeedType>('teammates');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mutualMatches, setMutualMatches] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const token = localStorage.getItem('csh_token');
  const api = import.meta.env.VITE_API_URL;
  const headers = { Authorization: `Bearer ${token}` };

  const loadFeed = async (type: FeedType) => {
    setDone(false);
    setCurrentIndex(0);
    if (type === 'mutual') {
      setLoading(true);
      try {
        const res = await axios.get(`${api}/api/match/mutual`, { headers });
        setMutualMatches(res.data.matches || []);
      } catch { setMutualMatches([]); }
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`${api}/api/match/feed?type=${type}`, { headers });
      setFeed(res.data.feed || []);
    } catch { setFeed([]); }
    setLoading(false);
  };

  useEffect(() => { loadFeed(feedType); }, [feedType]);

  const handleAction = async (action: 'like' | 'skip') => {
    const item = feed[currentIndex];
    if (!item) return;

    const targetType = feedType === 'projects' ? 'project' : feedType === 'mentors' ? 'mentor' : 'user';
    try {
      const res = await axios.post(`${api}/api/match/interest`,
        { target_id: item.id, target_type: targetType, action },
        { headers }
      );
      if (res.data.is_mutual) {
        const name = item.name || item.title || 'Someone';
        setToast(`It's a match with ${name}! 🎉`);
        setTimeout(() => setToast(null), 3500);
      }
    } catch { /* ignore */ }

    if (currentIndex + 1 >= feed.length) setDone(true);
    else setCurrentIndex(i => i + 1);
  };

  const item = feed[currentIndex];

  return (
    <div className="matchmaking-container">

      {toast && <div className="matchmaking-toast">{toast}</div>}

      <h2 className="matchmaking-title">Smart Match</h2>
      <p className="matchmaking-subtitle">
        AI-powered recommendations based on your skills, interests, and goals
      </p>

      <div className="matchmaking-tabs">
        {(Object.keys(TAB_LABELS) as FeedType[]).map(t => (
          <button
            key={t}
            onClick={() => setFeedType(t)}
            className={`tab-btn${feedType === t ? ' active' : ''}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading && (
        <div className="matchmaking-loading">
          <div className="matchmaking-loading-icon">⏳</div>
          <p>Finding your best matches…</p>
        </div>
      )}

      {/* Mutual matches list */}
      {!loading && feedType === 'mutual' && (
        mutualMatches.length === 0 ? (
          <div className="matchmaking-empty">
            <div className="matchmaking-empty-icon">💭</div>
            <p>No mutual matches yet — start swiping!</p>
          </div>
        ) : (
          <div className="mutual-grid">
            {mutualMatches.map(m => (
              <div key={m.id} className="mutual-card">
                <div className="mutual-card-header">
                  <div className="match-avatar teammate">
                    {(m.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="match-info">
                    <div className="match-name">{m.name}</div>
                    <div className="match-role">{m.role}</div>
                  </div>
                  <span className="matched-badge">Matched ✓</span>
                </div>
                {m.bio && <p className="mutual-card-bio">{m.bio}</p>}
                <div className="pills-row">
                  {(m.skills || []).slice(0, 5).map(s => <Pill key={s} label={s} type="skill" />)}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Card feed */}
      {!loading && feedType !== 'mutual' && (
        done || !item ? (
          <div className="matchmaking-done">
            <div className="matchmaking-done-icon">🎉</div>
            <h3>You've seen everyone!</h3>
            <p>Check back later for new matches.</p>
            <button onClick={() => loadFeed(feedType)} className="btn-refresh">
              Refresh
            </button>
          </div>
        ) : (
          <>
            <div className="matchmaking-progress">
              <span>{currentIndex + 1} of {feed.length}</span>
              <span>
                {feedType === 'teammates' ? 'Potential teammate'
                  : feedType === 'projects' ? 'Project match'
                  : 'Mentor match'}
              </span>
            </div>

            <div className="match-card">
              <div className="score-badge" style={{ background: scoreColor(item.score) }}>
                {item.score}% match
              </div>

              {feedType === 'projects' ? (
                <>
                  <div className="match-card-header">
                    <div className="match-avatar project">🚀</div>
                    <div className="match-info">
                      <h3>{item.title}</h3>
                      <div className="match-role">
                        {[item.category, item.stage, item.team_size != null ? `${item.team_size} members` : null]
                          .filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                  {item.description && (
                    <p className="match-bio">
                      {item.description.slice(0, 220)}{item.description.length > 220 ? '…' : ''}
                    </p>
                  )}
                  {(item.skills_required || []).length > 0 && (
                    <div className="pills-section">
                      <div className="pills-label">Skills Needed</div>
                      <div className="pills-row">
                        {(item.skills_required || []).map(s => <Pill key={s} label={s} type="skill" />)}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="match-card-header">
                    <div className={`match-avatar large ${feedType === 'mentors' ? 'mentor' : 'teammate'}`}>
                      {(item.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="match-info">
                      <h3>{item.name}</h3>
                      <div className="match-role">
                        {feedType === 'mentors' ? '🎓 Mentor' : `👤 ${item.role || 'Student'}`}
                      </div>
                    </div>
                  </div>
                  {item.bio && (
                    <p className="match-bio">
                      {item.bio.slice(0, 220)}{(item.bio || '').length > 220 ? '…' : ''}
                    </p>
                  )}
                  {(item.skills || []).length > 0 && (
                    <div className="pills-section">
                      <div className="pills-label">Skills</div>
                      <div className="pills-row">
                        {(item.skills || []).slice(0, 6).map(s => <Pill key={s} label={s} type="skill" />)}
                      </div>
                    </div>
                  )}
                  {(item.interests || []).length > 0 && (
                    <div className="pills-section">
                      <div className="pills-label">Interests</div>
                      <div className="pills-row">
                        {(item.interests || []).slice(0, 5).map(i => <Pill key={i} label={i} type="interest" />)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="match-actions">
              <button onClick={() => handleAction('skip')} className="btn-pass">
                ✕ Pass
              </button>
              <button onClick={() => handleAction('like')} className="btn-connect">
                ♥ Connect
              </button>
            </div>
          </>
        )
      )}
    </div>
  );
};

export default Matchmaking;
