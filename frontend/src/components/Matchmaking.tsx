import { useState, useEffect } from 'react';
import { MatchmakingService, type FeedItem, type FeedType } from '../services/matchmakingService';
import './Matchmaking.css';

interface MatchmakingProps {
  userId: string;
  userRole?: string;
}

const STUDENT_TABS: { type: FeedType; label: string; icon: string; targetType: 'user' | 'mentor' | 'project' | null }[] = [
  { type: 'teammates', label: 'Teammates',   icon: '👥', targetType: 'user'    },
  { type: 'mentors',   label: 'Mentors',     icon: '🎓', targetType: 'mentor'  },
  { type: 'projects',  label: 'Projects',    icon: '🚀', targetType: 'project' },
  { type: 'mutual',    label: 'My Matches',  icon: '❤️', targetType: null      },
];

const MENTOR_TABS: { type: FeedType; label: string; icon: string; targetType: 'user' | 'mentor' | 'project' | null }[] = [
  { type: 'teammates', label: 'Find Students', icon: '👤', targetType: 'user'    },
  { type: 'projects',  label: 'Projects',      icon: '🚀', targetType: 'project' },
  { type: 'mutual',    label: 'My Matches',    icon: '❤️', targetType: null      },
];

const scoreLabel = (s: number) => s >= 75 ? 'Excellent' : s >= 55 ? 'Strong' : s >= 35 ? 'Good' : 'Possible';
const scoreClass = (s: number) => s >= 75 ? 'score-excellent' : s >= 55 ? 'score-strong' : s >= 35 ? 'score-good' : 'score-low';

const Pill = ({ label, type }: { label: string; type: 'skill' | 'interest' }) => (
  <span className={`mm-pill mm-pill-${type}`}>{label}</span>
);

const AvatarCircle = ({ name, variant }: { name: string; variant: 'teammate' | 'mentor' | 'project' }) => (
  <div className={`mm-avatar mm-avatar-${variant}`}>
    {variant === 'project' ? '🚀' : (name || '?')[0].toUpperCase()}
  </div>
);

export default function Matchmaking({ userId: _userId, userRole }: MatchmakingProps) {
  const isMentor = userRole === 'mentor';
  const TAB_CONFIG = isMentor ? MENTOR_TABS : STUDENT_TABS;
  const [tab, setTab] = useState<FeedType>('teammates');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [mutual, setMutual] = useState<FeedItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadFeed = async (type: FeedType) => {
    setLoading(true);
    setDone(false);
    setIndex(0);
    try {
      if (type === 'mutual') {
        const data = await MatchmakingService.getMutualMatches();
        setMutual(data);
      } else {
        const data = await MatchmakingService.getFeed(type);
        setFeed(data);
      }
    } catch (err) {
      console.error('Failed to load matchmaking feed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFeed(tab); }, [tab]);

  const handleAction = async (action: 'like' | 'skip') => {
    const item = feed[index];
    if (!item || actionLoading) return;

    const tabConfig = TAB_CONFIG.find(t => t.type === tab);
    const targetType = tabConfig?.targetType as 'user' | 'mentor' | 'project';

    setActionLoading(true);
    try {
      const result = await MatchmakingService.expressInterest(item.id, targetType, action);
      if (result.is_mutual) {
        const name = item.name || item.title || 'Someone';
        showToast(`🎉 It's a Match with ${name}! Start collaborating.`);
        loadFeed('mutual');
      }
    } catch (err) {
      console.error('Interest action failed:', err);
    } finally {
      setActionLoading(false);
    }

    if (index + 1 >= feed.length) setDone(true);
    else setIndex(i => i + 1);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const item = feed[index];

  return (
    <div className="mm-container">
      {toast && (
        <div className="mm-toast">
          <span>{toast}</span>
        </div>
      )}

      <div className="mm-header">
        <h2 className="mm-title">AI Match</h2>
        <p className="mm-subtitle">
          {isMentor
            ? 'Gemini AI finds students who match your expertise and mentoring style'
            : 'Gemini AI finds your best collaborators using semantic profile analysis'}
        </p>
      </div>

      <div className="mm-tabs">
        {TAB_CONFIG.map(t => (
          <button
            key={t.type}
            className={`mm-tab ${tab === t.type ? 'active' : ''}`}
            onClick={() => setTab(t.type)}
          >
            <span className="mm-tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mm-loading">
          <div className="mm-loading-spinner" />
          <p>Gemini AI is finding your best matches…</p>
        </div>
      )}

      {/* Mutual matches grid */}
      {!loading && tab === 'mutual' && (
        mutual.length === 0 ? (
          <div className="mm-empty">
            <div className="mm-empty-icon">💭</div>
            <h3>No mutual matches yet</h3>
            <p>Start connecting with teammates and mentors to see your matches here.</p>
          </div>
        ) : (
          <div className="mm-mutual-grid">
            {mutual.map(m => (
              <div key={m.id} className="mm-mutual-card">
                <div className="mm-mutual-card-top">
                  <AvatarCircle name={m.name || ''} variant={m.role === 'mentor' ? 'mentor' : 'teammate'} />
                  <div className="mm-mutual-info">
                    <div className="mm-mutual-name">{m.name}</div>
                    <div className="mm-mutual-role">{m.role === 'mentor' ? '🎓 Mentor' : '👤 Student'}</div>
                  </div>
                  <span className="mm-matched-badge">✓ Matched</span>
                </div>
                {m.bio && <p className="mm-mutual-bio">{m.bio.slice(0, 120)}{m.bio.length > 120 ? '…' : ''}</p>}
                <div className="mm-pills-row">
                  {(m.skills || []).slice(0, 4).map(s => <Pill key={s} label={s} type="skill" />)}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Card feed */}
      {!loading && tab !== 'mutual' && (
        done || !item ? (
          <div className="mm-done">
            <div className="mm-done-icon">🎉</div>
            <h3>You've seen everyone!</h3>
            <p>Check back later — new users join daily.</p>
            <button className="mm-refresh-btn" onClick={() => loadFeed(tab)}>
              ↻ Refresh
            </button>
          </div>
        ) : (
          <div className="mm-feed-layout">
            {/* Progress */}
            <div className="mm-progress">
              <div className="mm-progress-bar">
                <div
                  className="mm-progress-fill"
                  style={{ width: `${((index + 1) / feed.length) * 100}%` }}
                />
              </div>
              <span className="mm-progress-text">{index + 1} / {feed.length}</span>
            </div>

            {/* Match Card */}
            <div className="mm-card">
              {/* Score badge */}
              <div className={`mm-score-badge ${scoreClass(item.score)}`}>
                <span className="mm-score-num">{item.score}%</span>
                <span className="mm-score-label">{scoreLabel(item.score)} Match</span>
              </div>

              {tab === 'projects' ? (
                <>
                  <div className="mm-card-header">
                    <AvatarCircle name="" variant="project" />
                    <div className="mm-card-identity">
                      <h3 className="mm-card-name">{item.title}</h3>
                      <div className="mm-card-role">
                        {[item.category, item.stage, item.team_size != null ? `${item.team_size} members` : null]
                          .filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                  {item.description && (
                    <p className="mm-card-bio">
                      {item.description.slice(0, 240)}{item.description.length > 240 ? '…' : ''}
                    </p>
                  )}
                  {(item.skills_required || []).length > 0 && (
                    <div className="mm-pills-section">
                      <div className="mm-pills-label">Skills Needed</div>
                      <div className="mm-pills-row">
                        {(item.skills_required || []).map(s => <Pill key={s} label={s} type="skill" />)}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mm-card-header">
                    <AvatarCircle
                      name={item.name || ''}
                      variant={tab === 'mentors' ? 'mentor' : 'teammate'}
                    />
                    <div className="mm-card-identity">
                      <h3 className="mm-card-name">{item.name}</h3>
                      <div className="mm-card-role">
                        {tab === 'mentors' ? '🎓 Mentor' : `👤 ${item.role || 'Student'}`}
                      </div>
                    </div>
                  </div>

                  {item.bio && (
                    <p className="mm-card-bio">
                      {item.bio.slice(0, 200)}{item.bio.length > 200 ? '…' : ''}
                    </p>
                  )}

                  {/* AI Explanation — the key feature */}
                  {item.ai_explanation && (
                    <div className="mm-ai-explanation">
                      <div className="mm-ai-explanation-header">
                        <span className="mm-ai-icon">✦</span>
                        <span>Why you match</span>
                      </div>
                      <p className="mm-ai-explanation-text">{item.ai_explanation}</p>
                    </div>
                  )}

                  {(item.skills || []).length > 0 && (
                    <div className="mm-pills-section">
                      <div className="mm-pills-label">Skills</div>
                      <div className="mm-pills-row">
                        {(item.skills || []).slice(0, 6).map(s => <Pill key={s} label={s} type="skill" />)}
                      </div>
                    </div>
                  )}

                  {(item.interests || []).length > 0 && (
                    <div className="mm-pills-section">
                      <div className="mm-pills-label">Interests</div>
                      <div className="mm-pills-row">
                        {(item.interests || []).slice(0, 5).map(i => <Pill key={i} label={i} type="interest" />)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="mm-actions">
              <button
                className="mm-btn-pass"
                onClick={() => handleAction('skip')}
                disabled={actionLoading}
              >
                <span>✕</span> Pass
              </button>
              <button
                className="mm-btn-connect"
                onClick={() => handleAction('like')}
                disabled={actionLoading}
              >
                <span>♥</span> Connect
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}