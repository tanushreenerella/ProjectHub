// src/components/AIProposalAssistant.tsx
import { useState } from 'react';
import { AIService } from '../services/aiService';
import AnalysisDisplay from './AnalysisDisplay';
import { useAgentAnalysis } from '../hooks/useAgentAnalysis';
import './AIProposalAssistant.css';

const AIProposalAssistant: React.FC = () => {
  const [idea, setIdea] = useState('');
  const [aiResponse, setAiResponse] = useState<{
    feedback: string;
    score: number;
    strengths: string[];
    improvements: string[];
    businessNames: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'feedback' | 'names'>('feedback');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const { analysis, loading: analysisLoading, error: analysisError, fetchAnalysis } = useAgentAnalysis();
const handleAnalyzeIdea = async () => {
  if (!idea.trim()) return;

  setIsLoading(true);
  setAiResponse(null);

  try {
    const data = await AIService.improveProposal(idea);
    setAiResponse(data);
  } catch (error) {
    console.error('AI Service error:', error);
    setAiResponse({
      feedback: "Our AI mentor is currently busy. Please try again in a moment.",
      score: 7,
      strengths: ["Quick to implement", "Student-focused"],
      improvements: ["Gather more user feedback", "Validate market size"],
      businessNames: ["CampusHub", "UniStart", "StudentVenture"]
    });
  }

  setIsLoading(false);
};

const handleRunAgentAnalysis = async () => {
  try {
    setShowAnalysis(true);
    await fetchAnalysis(idea, []);
  } catch (error) {
    console.error('Failed to run agent analysis:', error);
  }
};
  const formatFeedback = (text: string) => {
    return text.split('\n').map((line, index) => {
      if (line.includes('🚀') || line.includes('🎯') || line.includes('💡')) {
        return <h4 key={index} className="feedback-section-title">{line}</h4>;
      } else if (line.trim().startsWith('-') || line.trim().startsWith('**')) {
        return <p key={index} className="feedback-bullet">{line.replace('**', '').replace('**', '')}</p>;
      } else if (line.trim() === '') {
        return <br key={index} />;
      } else {
        return <p key={index} className="feedback-paragraph">{line}</p>;
      }
    });
  };

  return (
    <div className="ai-assistant-container">
      <div className="ai-header">
        <div className="ai-icon">🤖</div>
        <div className="ai-title">
          <h2>AI Proposal Assistant</h2>
          <p>Get instant feedback and improvements for your startup idea</p>
        </div>
      </div>

      <div className="ai-input-section">
        <div className="input-group">
          <label>Describe Your Startup Idea</label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Example: 'A platform that helps students find study partners based on their courses and schedules...'"
            rows={4}
            className="idea-input"
          />
        </div>

        <button 
          onClick={handleAnalyzeIdea}
          disabled={isLoading || !idea.trim()}
          className={`analyze-btn ${isLoading ? 'loading' : ''}`}
        >
          {isLoading ? (
            <>
              <div className="spinner"></div>
              AI Analyzing Your Idea...
            </>
          ) : (
            '🚀 Analyze with AI'
          )}
        </button>
      </div>

      {aiResponse && (
        <div className="ai-results">
          {/* Score Card */}
          <div className="score-card">
            <div className="score-circle">
              <span className="score">{aiResponse.score}</span>
              <span className="score-label">/10</span>
            </div>
            <div className="score-text">
              <h3>AI Validation Score</h3>
              <p>Based on market potential, feasibility, and student relevance</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="results-tabs">
            <button 
              className={`tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
              onClick={() => setActiveTab('feedback')}
            >
              📊 Detailed Feedback
            </button>
            <button 
              className={`tab-btn ${activeTab === 'names' ? 'active' : ''}`}
              onClick={() => setActiveTab('names')}
            >
              💡 Business Names
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'feedback' && (
              <div className="feedback-content">
                <div className="feedback-text">
                  {formatFeedback(aiResponse.feedback)}
                </div>

                <div className="analysis-grid">
                  <div className="analysis-card strengths">
                    <h4>✅ Strengths</h4>
                    <ul>
                      {aiResponse.strengths.map((strength, index) => (
                        <li key={index}>{strength}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="analysis-card improvements">
                    <h4>📈 Areas for Improvement</h4>
                    <ul>
                      {aiResponse.improvements.map((improvement, index) => (
                        <li key={index}>{improvement}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="action-buttons">
                  <button 
  className="action-btn primary"
  onClick={async () => {
    const token = localStorage.getItem("csh_token");

    await fetch("http://127.0.0.1:5000/api/projects/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
  title: aiResponse?.businessNames?.[0] || idea.slice(0, 40),
  description: aiResponse?.feedback,
  category: "AI Generated",
  stage: "ideation",
  skillsNeeded: []
})

    });

    alert("Project created from idea 🚀");
  }}
>
  📝 Create Project from This Idea
</button>

                  <button 
                    className="action-btn secondary"
                    onClick={handleRunAgentAnalysis}
                    disabled={analysisLoading}
                  >
                    {analysisLoading ? '🔄 Running Analysis...' : '🤖 Get Agent Analysis'}
                  </button>

                  <button className="action-btn secondary">
                    👥 Find Team Members
                  </button>
                  <button className="action-btn secondary">
                    💼 Apply for Funding
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'names' && (
              <div className="business-names-content">
                <h4>AI-Generated Business Names</h4>
                <p>Choose a name that resonates with your target audience</p>
                
                <div className="names-grid">
                  {aiResponse.businessNames.map((name, index) => (
                    <div key={index} className="name-card">
                      <h5>{name}</h5>
                      <button className="select-name-btn">
                        Select Name
                      </button>
                    </div>
                  ))}
                </div>

                <div className="naming-tips">
                  <h5>💡 Naming Tips</h5>
                  <ul>
                    <li>Keep it short and memorable</li>
                    <li>Make it relevant to your solution</li>
                    <li>Check domain name availability</li>
                    <li>Ensure it's easy to spell and pronounce</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAnalysis && analysis && (
        <AnalysisDisplay
          evaluation={analysis.evaluation}
          proposal={analysis.proposal}
          teamSuggestions={analysis.teamSuggestions}
          onClose={() => setShowAnalysis(false)}
        />
      )}

      {analysisError && showAnalysis && (
        <div className="analysis-error">
          <p>Failed to load analysis: {analysisError}</p>
          <button onClick={() => setShowAnalysis(false)}>Close</button>
        </div>
      )}

      {/* Example Ideas */}
      {!aiResponse && !isLoading && (
        <div className="example-ideas">
          <h4>💡 Need Inspiration? Try These:</h4>
          <div className="example-cards">
            <button 
              className="example-card"
              onClick={() => setIdea('A platform that connects students with local internships and part-time jobs')}
            >
              <span>💼 Student Internship Platform</span>
            </button>
            <button 
              className="example-card"
              onClick={() => setIdea('Food delivery service specifically for campus late-night dining')}
            >
              <span>🍕 Campus Food Delivery</span>
            </button>
            <button 
              className="example-card"
              onClick={() => setIdea('Peer-to-peer textbook exchange marketplace for students')}
            >
              <span>📚 Textbook Exchange</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIProposalAssistant;