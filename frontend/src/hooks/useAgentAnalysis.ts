
import { useState } from 'react';

interface AgentAnalysis {
  evaluation: string;
  proposal: string;
  teamSuggestions: string;
}

interface UseAgentAnalysisReturn {
  analysis: AgentAnalysis | null;
  loading: boolean;
  error: string | null;
  fetchAnalysis: (description: string, users: string[]) => Promise<void>;
  clearAnalysis: () => void;
}

export const useAgentAnalysis = (): UseAgentAnalysisReturn => {
  const [analysis, setAnalysis] = useState<AgentAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async (description: string, users: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('csh_token');
      const response = await fetch('http://localhost:5000/api/agents/startup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          description,
          users,
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data: AgentAnalysis = await response.json();
      setAnalysis({
        evaluation: data.evaluation || "No evaluation available",
        proposal: data.proposal || "No proposal available",
        teamSuggestions: data.teamSuggestions || data.teamSuggestions || "No team suggestions available"
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analysis';
      setError(errorMessage);
      console.error('Agent analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearAnalysis = () => {
    setAnalysis(null);
    setError(null);
  };

  return {
    analysis,
    loading,
    error,
    fetchAnalysis,
    clearAnalysis,
  };
};
