import { useEffect, useRef, useState } from "react";
import { AIService } from "../services/aiService";
import "./AIProposalAssistant.css";

type AssistantMode = "idea" | "proposal" | "copilot" | "investor";

interface AIResponse {
  feedback: string;
  score: number;
  strengths: string[];
  improvements: string[];
  businessNames: string[];
}

interface CopilotProjectOption {
  id: string;
  title: string;
  description?: string;
}

interface InvestorReport {
  evaluation: string;
  proposal: string;
  teamSuggestions: string;
}

const COPILOT_SUGGESTED_QUESTIONS = [
  "What are the biggest blockers in this project right now?",
  "What should this team focus on next?",
  "Is this project ready for funding yet?",
  "What skills or roles are missing in this team?"
];

// Simple markdown-like renderer — strips ** and renders sections
const renderMarkdownText = (text: string) => {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    const clean = line.replace(/\*\*/g, "");
    if (!clean.trim()) return <br key={i} />;
    if (clean.trim().startsWith("# ")) return <h3 key={i} className="investor-h3">{clean.replace("# ", "")}</h3>;
    if (clean.trim().startsWith("## ")) return <h4 key={i} className="investor-h4">{clean.replace("## ", "")}</h4>;
    if (clean.trim().match(/^\d+\./)) return <p key={i} className="investor-numbered">{clean}</p>;
    if (clean.trim().startsWith("- ") || clean.trim().startsWith("• "))
      return <p key={i} className="investor-bullet">{clean.replace(/^[-•]\s/, "")}</p>;
    if (clean.includes(":") && clean.trim().length < 60)
      return <p key={i} className="investor-label">{clean}</p>;
    return <p key={i} className="investor-text">{clean}</p>;
  });
};

const AIProposalAssistant: React.FC = () => {
  const [idea, setIdea] = useState("");
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("idea");
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"feedback" | "names">("feedback");
  const [, setProposalDraft] = useState("");
  const [proposalLoading, setProposalLoading] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [copilotProjects, setCopilotProjects] = useState<CopilotProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotResult, setCopilotResult] = useState<{
    answer: string;
    retrieved_context: Array<{ source_type: string; text: string; score: number }>;
  } | null>(null);

  // Investor report state
  const [investorIdea, setInvestorIdea] = useState("");
  const [investorReport, setInvestorReport] = useState<InvestorReport | null>(null);
  const [investorLoading, setInvestorLoading] = useState(false);
  const [investorTab, setInvestorTab] = useState<"evaluation" | "proposal" | "team">("evaluation");

  const handleModeChange = (mode: AssistantMode) => {
    setAssistantMode(mode);
    setActiveTab("feedback");
    if (mode === "copilot") setAiResponse(null);
    else setCopilotResult(null);
  };

  const hasFetchedProjects = useRef(false);

  useEffect(() => {
    if (assistantMode !== "copilot" || copilotProjects.length > 0 || hasFetchedProjects.current) return;
    hasFetchedProjects.current = true;
    const fetchProjects = async () => {
      setProjectsLoading(true);
      try {
        const token = localStorage.getItem("csh_token");
        if (!token) return;
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.status === 401) {
          localStorage.removeItem("csh_token");
          window.location.assign("#/signin");
          return;
        }
        if (!response.ok) throw new Error(`Projects fetch failed: ${response.status}`);
        const data = await response.json();
        const projects = Array.isArray(data.projects) ? data.projects : [];
        setCopilotProjects(
          projects
            .map((p: any) => ({ id: p.id || p._id || "", title: p.title || "Untitled Project", description: p.description || "" }))
            .filter((p: CopilotProjectOption) => p.id)
        );
      } catch (error) {
        console.error("Failed to load projects:", error);
      } finally {
        setProjectsLoading(false);
      }
    };
    fetchProjects();
  }, [assistantMode, copilotProjects.length]);

  const handleRunRagCopilot = async () => {
    if (!projectId.trim() || !copilotQuery.trim()) return;
    setCopilotLoading(true);
    setCopilotResult(null);
    try {
      const token = localStorage.getItem("csh_token");
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/project-rag-copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId, query: copilotQuery })
      });
      if (!response.ok) throw new Error(`Copilot failed: ${response.status}`);
      const data = await response.json();
      setCopilotResult(data);
    } catch (error) {
      console.error("RAG copilot failed:", error);
      setCopilotResult({ answer: "AI copilot could not generate a response right now.", retrieved_context: [] });
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
    } catch {
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

  const handleGenerateProposalDraft = async () => {
    if (!idea.trim()) return;
    setProposalLoading(true);
    try {
      let analysis = aiResponse;
      if (!analysis) {
        analysis = await AIService.improveProposal(idea);
        setAiResponse(analysis);
      }
      const strengths = (analysis?.strengths || []).map((i) => `- ${i}`).join("\n");
      const improvements = (analysis?.improvements || []).map((i) => `- ${i}`).join("\n");
      const draft = `Startup Proposal Draft\n\nWorking Title:\n${analysis?.businessNames?.[0] || idea.slice(0, 40)}\n\nIdea Summary:\n${idea}\n\nProblem Statement:\n${analysis?.feedback || "This startup aims to solve a meaningful and validated user problem."}\n\nTarget Audience:\n- Students\n- Early-stage founders\n- Campus communities\n\nKey Strengths:\n${strengths || "- Strong relevance to student needs"}\n\nKey Risks / Improvements:\n${improvements || "- Clarify value proposition"}\n\nInitial MVP Plan:\n- Build the smallest useful version first\n- Validate with 5-10 real users\n- Prioritize only the top 3 features\n\nGo-To-Market Direction:\n- Launch with a focused student segment\n- Collect feedback and testimonials\n- Expand after proving traction\n`;
      setProposalDraft(draft);
      setAssistantMode("proposal");
    } catch (error) {
      console.error("Failed to generate proposal draft:", error);
    } finally {
      setProposalLoading(false);
    }
  };

  const handleRunInvestorReport = async () => {
    if (!investorIdea.trim()) return;
    setInvestorLoading(true);
    setInvestorReport(null);
    try {
      const token = localStorage.getItem("csh_token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/agents/startup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: investorIdea, users: [] })
      });
      const data = await res.json();
      setInvestorReport({
        evaluation: data.evaluation || "",
        proposal: data.proposal || "",
        teamSuggestions: data.team_suggestions || ""
      });
      setInvestorTab("evaluation");
    } catch (error) {
      console.error("Investor report failed:", error);
    } finally {
      setInvestorLoading(false);
    }
  };

  const formatFeedback = (text: string) => {
    return text.split("\n").map((line, index) => {
      if (line.includes("Problem & Solution") || line.includes("Market Potential") || line.includes("Path Forward"))
        return <h4 key={index} className="feedback-section-title">{line}</h4>;
      if (line.trim().startsWith("-") || line.trim().startsWith("**"))
        return <p key={index} className="feedback-bullet">{line.replaceAll("**", "")}</p>;
      if (line.trim() === "") return <br key={index} />;
      return <p key={index} className="feedback-paragraph">{line}</p>;
    });
  };

  const recommendedNextStep = aiResponse?.improvements?.[0] || "Validate your startup idea with 5-10 target users before building further.";



  return (
    <div className="ai-assistant-container">
      <div className="ai-header" />

      {/* Mode Tabs */}
      <div className="ai-mode-tabs">
        {[
          { id: "idea", label: "Idea Review" },
          { id: "copilot", label: "Project Copilot" },
          { id: "investor", label: "Investor Report" }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${assistantMode === tab.id ? "active" : ""}`}
            onClick={() => handleModeChange(tab.id as AssistantMode)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="ai-input-section">
        {/* Mode summary */}
        <div className="assistant-mode-summary">
          {assistantMode === "idea" && <p>Validate market potential, strengths, and risks before you start building.</p>}
          {assistantMode === "proposal" && <p>Turn your startup concept into a cleaner, more structured proposal draft.</p>}
          {assistantMode === "copilot" && <p>Ask questions grounded in your actual project data — tasks, team, and activity.</p>}
          {assistantMode === "investor" && <p>Get a full investor-grade evaluation, funding proposal, and team structure recommendation.</p>}
        </div>

        {/* ── IDEA REVIEW ── */}
        {assistantMode === "idea" && (
          <>
            <div className="input-group">
              <label>Describe Your Startup Idea</label>
              <textarea value={idea} onChange={(e) => setIdea(e.target.value)}
                placeholder="Example: A platform that helps students find startup teammates based on skills and interests."
                rows={3} className="idea-input" />
            </div>
            <div className="ai-primary-actions">
              <button onClick={handleAnalyzeIdea} disabled={isLoading || !idea.trim()}
                className={`analyze-btn ${isLoading ? "loading" : ""}`}>
                {isLoading ? "Analyzing..." : "Analyze with AI"}
              </button>
              <button className="action-btn secondary" onClick={handleGenerateProposalDraft}
                disabled={proposalLoading || !idea.trim()}>
                {proposalLoading ? "Generating..." : "Generate Proposal Draft"}
              </button>
            </div>
          </>
        )}

       

        {/* ── PROJECT COPILOT ── */}
        {assistantMode === "copilot" && (
          <div className="copilot-rag-panel">
            <div className="input-group">
              <label>Select Project</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="idea-input copilot-select">
                <option value="">{projectsLoading ? "Loading..." : "Choose one of your projects"}</option>
                {copilotProjects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              {!projectsLoading && copilotProjects.length === 0 &&
                <p className="copilot-helper-text">No projects found. Create a project first.</p>}
            </div>
            <div className="input-group">
              <label>Ask About Your Project</label>
              <textarea value={copilotQuery} onChange={(e) => setCopilotQuery(e.target.value)}
                placeholder="What are the biggest blockers in this project right now?"
                rows={2} className="idea-input" />
            </div>
            <div className="copilot-suggestions">
              {COPILOT_SUGGESTED_QUESTIONS.map((q) => (
                <button key={q} type="button" className="copilot-suggestion-chip" onClick={() => setCopilotQuery(q)}>{q}</button>
              ))}
            </div>
            <button className="analyze-btn" onClick={handleRunRagCopilot}
              disabled={copilotLoading || !projectId.trim() || !copilotQuery.trim()}>
              {copilotLoading ? "Running Copilot..." : "Ask Project Copilot"}
            </button>
            {copilotResult && (
              <div className="copilot-result-section">
                <div className="analysis-card">
                  <h4>AI Copilot Answer</h4>
                  <p>{copilotResult.answer}</p>
                </div>
                {copilotResult.retrieved_context.length > 0 && (
                  <div className="analysis-card">
                    <h4>Retrieved Project Context</h4>
                    <ul>
                      {copilotResult.retrieved_context.map((item, i) => (
                        <li key={i}><strong>{item.source_type}</strong>: {item.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── INVESTOR REPORT ── */}
        {assistantMode === "investor" && (
          <div className="investor-panel">
            {!investorReport && (
              <>
                <div className="input-group">
                  <label>Describe Your Startup Idea</label>
                  <textarea value={investorIdea} onChange={(e) => setInvestorIdea(e.target.value)}
                    placeholder="Describe your startup idea in detail — problem, solution, target market, and how you plan to make money."
                    rows={4} className="idea-input" />
                </div>
                <div className="investor-what-you-get">
                  <p className="investor-preview-label">You'll receive:</p>
                  <div className="investor-preview-chips">
                    <span>📊 Investor Evaluation</span>
                    <span>📄 Funding Proposal</span>
                    <span>👥 Team Structure</span>
                  </div>
                </div>
                <button className="analyze-btn" onClick={handleRunInvestorReport}
                  disabled={investorLoading || !investorIdea.trim()}>
                  {investorLoading ? "Generating Report..." : "Generate Investor Report"}
                </button>
              </>
            )}

            {investorLoading && (
              <div className="investor-loading">
                <div className="investor-loading-dots">
                  <span /><span /><span />
                </div>
                <p>Running 3 AI agents — evaluation, proposal, and team analysis...</p>
              </div>
            )}

            {investorReport && !investorLoading && (
              <div className="investor-report">
                {/* Report header */}
                <div className="investor-report-header">
                  <div className="investor-report-title">
                    <h3>Investor Report</h3>
                    <p>{investorIdea.slice(0, 60)}{investorIdea.length > 60 ? "..." : ""}</p>
                  </div>
                  <button className="action-btn secondary" onClick={() => setInvestorReport(null)}>
                    New Report
                  </button>
                </div>

                {/* Report tabs */}
                <div className="investor-tabs">
                  {[
                    { id: "evaluation", label: "📊 Evaluation" },
                    { id: "proposal", label: "📄 Proposal" },
                    { id: "team", label: "👥 Team" }
                  ].map((t) => (
                    <button key={t.id}
                      className={`investor-tab-btn ${investorTab === t.id ? "active" : ""}`}
                      onClick={() => setInvestorTab(t.id as any)}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Report content */}
                <div className="investor-report-body">
                  {investorTab === "evaluation" && (
                    <div className="investor-section">
                      <div className="investor-section-badge evaluation-badge">Investor Evaluation</div>
                      <div className="investor-content">
                        {renderMarkdownText(investorReport.evaluation)}
                      </div>
                    </div>
                  )}
                  {investorTab === "proposal" && (
                    <div className="investor-section">
                      <div className="investor-section-badge proposal-badge">Funding Proposal</div>
                      <div className="investor-content">
                        {renderMarkdownText(investorReport.proposal)}
                      </div>
                    </div>
                  )}
                  {investorTab === "team" && (
                    <div className="investor-section">
                      <div className="investor-section-badge team-badge">Team Structure</div>
                      <div className="investor-content">
                        {renderMarkdownText(investorReport.teamSuggestions)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── IDEA RESULTS ── */}
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
            <button className={`tab-btn ${activeTab === "feedback" ? "active" : ""}`} onClick={() => setActiveTab("feedback")}>
              Detailed Feedback
            </button>
            <button className={`tab-btn ${activeTab === "names" ? "active" : ""}`} onClick={() => setActiveTab("names")}>
              Business Names
            </button>
          </div>

          <div className="tab-content">
            {activeTab === "feedback" && (
              <div className="feedback-content">
                <div className="feedback-text">{formatFeedback(aiResponse.feedback)}</div>
                <div className="analysis-grid">
                  <div className="analysis-card strengths">
                    <h4>Strengths</h4>
                    <ul>{aiResponse.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                  <div className="analysis-card improvements">
                    <h4>Areas for Improvement</h4>
                    <ul>{aiResponse.improvements.map((imp, i) => <li key={i}>{imp}</li>)}</ul>
                  </div>
                  <div className="analysis-card next-step-card">
                    <h4>Recommended Next Step</h4>
                    <p>{recommendedNextStep}</p>
                  </div>
                </div>
                <div className="action-buttons">
                  <button className="action-btn primary" onClick={async () => {
                    const token = localStorage.getItem("csh_token");
                    await fetch(`${import.meta.env.VITE_API_URL}/api/projects/`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({
                        title: aiResponse?.businessNames?.[0] || idea.slice(0, 40),
                        description: aiResponse?.feedback,
                        category: "AI Generated",
                        stage: "ideation",
                        skillsNeeded: []
                      })
                    });
                    alert("Project created from idea.");
                  }}>
                    Create Project from This Idea
                  </button>
                  <button className="action-btn secondary" onClick={() => { setInvestorIdea(idea); handleModeChange("investor"); }}>
                    Get Investor Report
                  </button>
                  <button className="action-btn secondary">Find Team Members</button>
                  <button className="action-btn secondary">Apply for Funding</button>
                </div>
              </div>
            )}
            {activeTab === "names" && (
              <div className="business-names-content">
                <h4>AI-Generated Business Names</h4>
                <p>Choose a name that best matches your startup direction.</p>
                <div className="names-grid">
                  {aiResponse.businessNames.map((name, i) => (
                    <div key={i} className="name-card">
                      <h5>{name}</h5>
                      <button className="select-name-btn">Select Name</button>
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

      {assistantMode === "idea" && !aiResponse && !isLoading && (
        <div className="example-ideas">
          <h4>Try These Startup Ideas</h4>
          <div className="example-cards">
            <button className="example-card" onClick={() => setIdea("A platform that connects students with local internships and part-time jobs")}>
              <span>Student Internship Platform</span>
            </button>
            <button className="example-card" onClick={() => setIdea("Food delivery service specifically for campus late-night dining")}>
              <span>Campus Food Delivery</span>
            </button>
            <button className="example-card" onClick={() => setIdea("Peer-to-peer textbook exchange marketplace for students")}>
              <span>Textbook Exchange</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIProposalAssistant;