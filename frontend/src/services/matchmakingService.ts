const API = import.meta.env.VITE_API_URL;

const headers = () => {
  const token = localStorage.getItem('csh_token');
  if (!token) {
    throw new Error('Please sign in again to use matchmaking.');
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const readError = async (res: Response, fallback: string) => {
  const data = await res.json().catch(() => null);
  return data?.error || data?.msg || fallback;
};

export interface FeedItem {
  id: string;
  // user/mentor fields
  name?: string;
  role?: string;
  bio?: string;
  skills?: string[];
  interests?: string[];
  // project fields
  title?: string;
  description?: string;
  category?: string;
  stage?: string;
  skills_required?: string[];
  team_size?: number;
  // shared
  score: number;
  ai_explanation?: string | null;
}

export type FeedType = 'teammates' | 'mentors' | 'projects' | 'mutual';

export const MatchmakingService = {
  getFeed: async (type: Exclude<FeedType, 'mutual'>): Promise<FeedItem[]> => {
    const res = await fetch(`${API}/api/match/feed?type=${type}`, { headers: headers() });
    if (!res.ok) throw new Error(await readError(res, 'Failed to load feed'));
    const data = await res.json();
    return data.feed || [];
  },

  getMutualMatches: async (): Promise<FeedItem[]> => {
    const res = await fetch(`${API}/api/match/mutual`, { headers: headers() });
    if (!res.ok) throw new Error(await readError(res, 'Failed to load mutual matches'));
    const data = await res.json();
    return data.matches || [];
  },

  expressInterest: async (
    targetId: string,
    targetType: 'user' | 'mentor' | 'project',
    action: 'like' | 'skip'
  ): Promise<{ is_mutual: boolean }> => {
    const res = await fetch(`${API}/api/match/interest`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ target_id: targetId, target_type: targetType, action }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to record interest'));
    return res.json();
  },

  refreshEmbedding: async (): Promise<void> => {
    await fetch(`${API}/api/match/embed/refresh`, {
      method: 'POST',
      headers: headers(),
    });
  },
};
