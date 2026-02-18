import React from 'react';
import './AnalysisDisplay.css';

interface AnalysisProps {
  evaluation: string;
  proposal: string;
  teamSuggestions: string;
  onClose: () => void;
}

const AnalysisDisplay: React.FC<AnalysisProps> = ({ 
  evaluation = "", 
  proposal = "", 
  teamSuggestions = "", 
  onClose 
}) => {
  const parseSection = (text: string | undefined) => {
    if (!text) return [];
    return text.split('\n').filter(line => line.trim());
  };

  return (
    <div className="analysis-modal-overlay">
      <div className="analysis-modal">
        <div className="analysis-header">
          <h2>🤖 AI Analysis Report</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="analysis-content">
          {/* Evaluation Card */}
          <div className="analysis-card evaluation-card">
            <div className="card-header evaluation-header">
              <div className="card-icon">📊</div>
              <h3>Project Evaluation</h3>
            </div>
            <div className="card-body">
              {parseSection(evaluation).map((line, idx) => (
                <p key={idx} className={getLineClass(line)}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Proposal Card */}
          <div className="analysis-card proposal-card">
            <div className="card-header proposal-header">
              <div className="card-icon">💡</div>
              <h3>Project Proposal</h3>
            </div>
            <div className="card-body">
              {parseSection(proposal).map((line, idx) => (
                <p key={idx} className={getLineClass(line)}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Team Suggestions Card */}
          <div className="analysis-card team-card">
            <div className="card-header team-header">
              <div className="card-icon">👥</div>
              <h3>Team Composition</h3>
            </div>
            <div className="card-body">
              {parseSection(teamSuggestions).map((line, idx) => (
                <p key={idx} className={getLineClass(line)}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="analysis-footer">
          <button className="action-btn secondary" onClick={onClose}>
            Close Report
          </button>
          <button className="action-btn primary" onClick={() => window.print()}>
            📥 Download Report
          </button>
        </div>
      </div>
    </div>
  );
};

const getLineClass = (line: string): string => {
  if (line.includes(':')) return 'section-title';
  if (line.includes('•') || line.includes('-')) return 'bullet-point';
  if (line.match(/^\d+\./)) return 'numbered-item';
  return 'text-line';
};

export default AnalysisDisplay;
