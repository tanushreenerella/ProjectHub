import React from 'react';
import './AgentAnalysisPage.css';

interface AgentAnalysisPageProps {
  projectTitle: string;
  evaluation: string;
  proposal: string;
  teamSuggestions: string;
  onBack: () => void;
}

const AgentAnalysisPage: React.FC<AgentAnalysisPageProps> = ({
  projectTitle,
  evaluation,
  proposal,
  teamSuggestions,
  onBack
}) => {
  const parseSection = (text: string | undefined) => {
    if (!text) return [];
    return text.split('\n').filter(line => line.trim());
  };

  const getLineClass = (line: string): string => {
    if (line.includes(':')) return 'section-title';
    if (line.includes('•') || line.includes('-')) return 'bullet-point';
    if (line.match(/^\d+\./)) return 'numbered-item';
    return 'text-line';
  };

  return (
    <div className="analysis-page">
      <div className="analysis-page-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to Projects
        </button>
        <div className="header-content">
          <h1>🤖 AI Analysis Report</h1>
          <p className="project-name">{projectTitle}</p>
        </div>
        <div className="header-actions">
          <button className="export-btn" onClick={() => window.print()}>
            📥 Download Report
          </button>
        </div>
      </div>

      <div className="analysis-page-content">
        {/* Evaluation Section */}
        <div className="analysis-section evaluation-section">
          <div className="section-header evaluation-header">
            <div className="section-icon">📊</div>
            <div className="section-title-text">
              <h2>Project Evaluation</h2>
              <p>Comprehensive assessment of your project viability</p>
            </div>
          </div>
          <div className="section-body">
            {parseSection(evaluation).map((line, idx) => (
              <p key={idx} className={getLineClass(line)}>
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Proposal Section */}
        <div className="analysis-section proposal-section">
          <div className="section-header proposal-header">
            <div className="section-icon">💡</div>
            <div className="section-title-text">
              <h2>Project Proposal</h2>
              <p>Strategic recommendations and business insights</p>
            </div>
          </div>
          <div className="section-body">
            {parseSection(proposal).map((line, idx) => (
              <p key={idx} className={getLineClass(line)}>
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Team Composition Section */}
        <div className="analysis-section team-section">
          <div className="section-header team-header">
            <div className="section-icon">👥</div>
            <div className="section-title-text">
              <h2>Team Composition</h2>
              <p>Recommended team structure and skill requirements</p>
            </div>
          </div>
          <div className="section-body">
            {parseSection(teamSuggestions).map((line, idx) => (
              <p key={idx} className={getLineClass(line)}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="analysis-page-footer">
        <button className="action-btn secondary" onClick={onBack}>
          ← Back to Projects
        </button>
        <button className="action-btn primary" onClick={() => window.print()}>
          📥 Download as PDF
        </button>
      </div>
    </div>
  );
};

export default AgentAnalysisPage;
