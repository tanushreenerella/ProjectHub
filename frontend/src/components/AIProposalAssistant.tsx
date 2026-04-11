import { useState } from "react";
import { AIService } from "../services/aiService";
import AnalysisDisplay from "./AnalysisDisplay";
import { useAgentAnalysis } from "../hooks/useAgentAnalysis";
import "./AIProposalAssistant.css";

type AssistantMode = "idea" | "proposal" | "copilot";

interface AIResponse {
  feedback: string;
  score: number;
  strengths: string[];
  improvements: string[];
  businessNames: string[];
}

const AIProposalAssistant: React.FC = () => {
  const [idea, setIdea] = useState("");
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("idea");
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"feedback" | "names">("feedback");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [proposalDraft, setProposalDraft] = useState("");
  const [proposalLoading, setProposalLoading] = useState(false);
  const { analysis, loading: analysisLoading, error: analysisError, fetchAnalysis } = useAgentAnalysis();
  const [projectId, setProjectId] = useState("");
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotResult, setCopilotResult] = useState<{
    answer: string;
    retrieved_context: Array<{
      source_type: string;
      text: string;
      score: number;
    }>;
  } | null>(null);

  const handleModeChange = (mode: AssistantMode) => {
    setAssistantMode(mode);
    setActiveTab("feedback");
    setShowAnalysis(false);

    if (mode === "copilot") {
      setAiResponse(null);
    } else {
      setCopilotResult(null);
    }
  };

  const handleRunRagCopilot = async () => {
    if (!projectId.trim() || !copilotQuery.trim()) return;

    setCopilotLoading(true);
    setCopilotResult(null);

    try {
      const token = localStorage.getItem("csh_token");

      const response = await fetch("http://localhost:10000/api/ai/project-rag-copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          project_id: projectId,
          query: copilotQuery
        })
      });

      if (!response.ok) {
        throw new Error(`Copilot failed: ${response.status}`);
      }

      const data = await response.json();
      setCopilotResult(data);
    } catch (error) {
      console.error("RAG copilot failed:", error);
      setCopilotResult({
        answer: "AI copilot could not generate a response right now.",
        retrieved_context: []
      });
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleAnalyzeIdea = async () => {
    if (!idea.trim()) return;

    setIsLoading(true);
    setAiResponse(null);

    try {
      const data = await AIService.improveProposal(idea);
      setAiResponse(data);
    } catch (error) {
      console.error("AI Service error:", error);
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
    if (!idea.trim()) return;

    try {
      setShowAnalysis(true);
      await fetchAnalysis(idea, []);
    } catch (error) {
      console.error("Failed to run agent analysis:", error);
    }
  };

  const handleGenerateProposalDraft = async () => {
    if (!idea.trim()) return;

    setProposalLoading(true);

    try {
      const strengths = (aiResponse?.strengths || []).map((item) => `- ${item}`).join("\n");
      const improvements = (aiResponse?.improvements || []).map((item) => `- ${item}`).join("\n");

      const draft = `Startup Proposal Draft

Working Title:
${aiResponse?.businessNames?.[0] || "Untitled Startup"}

Idea Summary:
${idea}

Problem Statement:
${aiResponse?.feedback || "This startup aims to solve a meaningful and validated user problem."}

Target Audience:
- Students
- Early-stage founders
- Campus communities

Key Strengths:
${strengths || "- Strong relevance to student needs\n- Clear room for market validation"}

Key Risks / Improvements:
${improvements || "- Clarify value proposition\n- Validate solution with real users"}

Initial MVP Plan:
- Build the smallest useful version first
- Validate with 5-10 real users
- Prioritize only the top 3 features

Go-To-Market Direction:
- Launch with a focused student segment
- Collect feedback and testimonials
- Expand after proving traction
`;

      setProposalDraft(draft);
      setAssistantMode("proposal");
    } catch (error) {
      console.error("Failed to generate proposal draft:", error);
    } finally {
      setProposalLoading(false);
    }
  };

  const formatFeedback = (text: string) => {
    return text.split("\n").map((line, index) => {
      if (line.includes("Problem & Solution") || line.includes("Market Potential") || line.includes("Path Forward")) {
        return <h4 key={index} className="feedback-section-title">{line}</h4>;
      }
      if (line.trim().startsWith("-") || line.trim().startsWith("**")) {
        return <p key={index} className="feedback-bullet">{line.replaceAll("**", "")}</p>;
      }
      if (line.trim() === "") {
        return <br key={index} />;
      }
      return <p key={index} className="feedback-paragraph">{line}</p>;
    });
  };

  const recommendedNextStep =
    aiResponse?.improvements?.[0] || "Validate your startup idea with 5-10 target users before building further.";

  const handleDownloadProposalDraft = () => {
    if (!proposalDraft.trim()) return;

    const blob = new Blob([proposalDraft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const draftTitle = aiResponse?.businessNames?.[0] || "startup-proposal-draft";
    link.href = url;
    link.download = `${draftTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrimaryAnalyze = async () => {
    if (assistantMode === "copilot") {
      await handleRunRagCopilot();
      return;
    }

    await handleAnalyzeIdea();
  };


  return (
    <div className="ai-assistant-container">
      <div className="ai-header">
        <div className="ai-title">
          <h2>AI Proposal Assistant</h2>
          <p>Review startup ideas, build proposal drafts, and prepare for execution.</p>
        </div>
      </div>

      <div className="ai-mode-tabs">
        <button
          className={`tab-btn ${assistantMode === "idea" ? "active" : ""}`}
          onClick={() => handleModeChange("idea")}
        >
          Idea Review
        </button>
        <button
          className={`tab-btn ${assistantMode === "proposal" ? "active" : ""}`}
          onClick={() => handleModeChange("proposal")}
        >
          Proposal Coach
        </button>
        <button
          className={`tab-btn ${assistantMode === "copilot" ? "active" : ""}`}
          onClick={() => handleModeChange("copilot")}
        >
          Project Copilot
        </button>
      </div>

      <div className="ai-input-section">
        <div className="assistant-mode-summary">
          {assistantMode === "idea" && (
            <p>Use Idea Review to validate market potential, strengths, and risks before you start building.</p>
          )}
          {assistantMode === "proposal" && (
            <p>Use Proposal Coach to turn your startup concept into a cleaner, more structured proposal draft.</p>
          )}
          {assistantMode === "copilot" && (
            <p>Use Project Copilot mode when you want deeper strategic analysis and next-step guidance for execution.</p>
          )}
        </div>

        {assistantMode !== "copilot" && (
          <div className="input-group">
            <label>
              {assistantMode === "idea" && "Describe Your Startup Idea"}
              {assistantMode === "proposal" && "Describe the Idea You Want to Turn into a Proposal"}
            </label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Example: A platform that helps students find startup teammates based on skills and interests."
              rows={4}
              className="idea-input"
            />
          </div>
        )}

        {assistantMode === "idea" && (
          <div className="ai-primary-actions">
            <button
              onClick={handlePrimaryAnalyze}
              disabled={(isLoading || analysisLoading) || !idea.trim()}
              className={`analyze-btn ${isLoading ? "loading" : ""}`}
            >
              {isLoading || analysisLoading ? "Analyzing..." : "Analyze with AI"}
            </button>

            <button
              className="action-btn secondary"
              onClick={handleGenerateProposalDraft}
              disabled={proposalLoading || !idea.trim()}
            >
              {proposalLoading ? "Generating Draft..." : "Generate Proposal Draft"}
            </button>
          </div>
        )}

        {assistantMode === "proposal" && (
          <>
            <div className="proposal-coach-actions">
              <button
                className="analyze-btn"
                onClick={handleGenerateProposalDraft}
                disabled={proposalLoading || !idea.trim()}
              >
                {proposalLoading ? "Generating Draft..." : "Generate Proposal Draft"}
              </button>

              <button
                className="action-btn secondary"
                onClick={handleDownloadProposalDraft}
                disabled={!proposalDraft.trim()}
              >
                Download Draft
              </button>
            </div>

            <div className="proposal-draft-section">
              <div className="proposal-draft-header">
                <div>
                  <h4>Proposal Draft Assistant</h4>
                  <p>Your generated startup proposal will appear here and stay ready for download.</p>
                </div>
              </div>

              {proposalDraft ? (
                <textarea
                  className="proposal-draft-textarea"
                  rows={14}
                  value={proposalDraft}
                  readOnly
                />
              ) : (
                <div className="proposal-draft-placeholder">
                  <p>Generate a draft to preview your proposal here before downloading it.</p>
                </div>
              )}
            </div>
          </>
        )}

       
       {assistantMode === "copilot" && (
  <div className="copilot-rag-panel">
    <div className="input-group">
      <label>Project ID</label>
      <input
        type="text"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        placeholder="Enter project id"
        className="idea-input"
      />
    </div>

    <div className="input-group">
      <label>Ask About Your Project</label>
      <textarea
        value={copilotQuery}
        onChange={(e) => setCopilotQuery(e.target.value)}
        placeholder="Example: What are the biggest blockers in this project right now?"
        rows={3}
        className="idea-input"
      />
    </div>

    <button
      className="analyze-btn"
      onClick={handleRunRagCopilot}
      disabled={copilotLoading || !projectId.trim() || !copilotQuery.trim()}
    >
      {copilotLoading ? "Running Project Copilot..." : "Ask Project Copilot"}
    </button>

    {copilotResult && (
      <div className="copilot-result-section">
        <div className="analysis-card">
          <h4>AI Copilot Answer</h4>
          <p>{copilotResult.answer}</p>
        </div>

        <div className="analysis-card">
          <h4>Retrieved Project Context</h4>
          {copilotResult.retrieved_context.length === 0 ? (
            <p>No supporting context retrieved.</p>
          ) : (
            <ul>
              {copilotResult.retrieved_context.map((item, index) => (
                <li key={index}>
                  <strong>{item.source_type}</strong>: {item.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )}
  </div>
)}
      </div>

      {assistantMode === "idea" && aiResponse && (
        <div className="ai-results">
          <div className="score-card">
            <div className="score-circle">
              <span className="score">{aiResponse.score}</span>
              <span className="score-label">/10</span>
            </div>
            <div className="score-text">
              <h3>AI Validation Score</h3>
              <p>Based on market potential, feasibility, and relevance for student founders.</p>
            </div>
          </div>

          <div className="results-tabs">
            <button
              className={`tab-btn ${activeTab === "feedback" ? "active" : ""}`}
              onClick={() => setActiveTab("feedback")}
            >
              Detailed Feedback
            </button>
            <button
              className={`tab-btn ${activeTab === "names" ? "active" : ""}`}
              onClick={() => setActiveTab("names")}
            >
              Business Names
            </button>
          </div>

          <div className="tab-content">
            {activeTab === "feedback" && (
              <div className="feedback-content">
                <div className="feedback-text">
                  {formatFeedback(aiResponse.feedback)}
                </div>

                <div className="analysis-grid">
                  <div className="analysis-card strengths">
                    <h4>Strengths</h4>
                    <ul>
                      {aiResponse.strengths.map((strength, index) => (
                        <li key={index}>{strength}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="analysis-card improvements">
                    <h4>Areas for Improvement</h4>
                    <ul>
                      {aiResponse.improvements.map((improvement, index) => (
                        <li key={index}>{improvement}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="analysis-card next-step-card">
                    <h4>Recommended Next Step</h4>
                    <p>{recommendedNextStep}</p>
                  </div>
                </div>

                <div className="action-buttons">
                  <button
                    className="action-btn primary"
                    onClick={async () => {
                      const token = localStorage.getItem("csh_token");

                      await fetch("http://localhost:10000/api/projects/", {
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

                      alert("Project created from idea.");
                    }}
                  >
                    Create Project from This Idea
                  </button>

                  <button
                    className="action-btn secondary"
                    onClick={handleRunAgentAnalysis}
                    disabled={analysisLoading || !idea.trim()}
                  >
                    {analysisLoading ? "Running Analysis..." : "Get Agent Analysis"}
                  </button>

                  <button className="action-btn secondary">
                    Find Team Members
                  </button>
                  <button className="action-btn secondary">
                    Apply for Funding
                  </button>
                </div>

              </div>
            )}

            {activeTab === "names" && (
              <div className="business-names-content">
                <h4>AI-Generated Business Names</h4>
                <p>Choose a name that best matches your startup direction.</p>

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
                  <h5>Naming Tips</h5>
                  <ul>
                    <li>Keep it short and memorable.</li>
                    <li>Make it relevant to your solution.</li>
                    <li>Check domain name availability.</li>
                    <li>Choose something easy to spell and pronounce.</li>
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
      {assistantMode === "idea" && !aiResponse && !isLoading && (
        <div className="example-ideas">
          <h4>Try These Startup Ideas</h4>
          <div className="example-cards">
            <button
              className="example-card"
              onClick={() => setIdea("A platform that connects students with local internships and part-time jobs")}
            >
              <span>Student Internship Platform</span>
            </button>
            <button
              className="example-card"
              onClick={() => setIdea("Food delivery service specifically for campus late-night dining")}
            >
              <span>Campus Food Delivery</span>
            </button>
            <button
              className="example-card"
              onClick={() => setIdea("Peer-to-peer textbook exchange marketplace for students")}
            >
              <span>Textbook Exchange</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIProposalAssistant;
