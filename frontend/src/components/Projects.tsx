import { useEffect, useState } from "react";
import "./Projects.css";
import AgentAnalysisPage from "./AgentAnalysisPage";

interface Project {
  _id: string;
  title: string;
  description: string;
  category: string;
  stage: string;
  skills_required: string[];
  created_at: string;
}

interface AnalysisData {
  evaluation: string;
  proposal: string;
  teamSuggestions: string;
  projectTitle: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    stage: "ideation",
    skillsNeeded: ""
  });

  const token = localStorage.getItem("csh_token");

  useEffect(() => {
    if (!token) return;

    fetch("http://127.0.0.1:5000/api/projects/my", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setProjects(data.projects || []);
        setLoading(false);
      });
  }, []);

  const createProject = async (e: any) => {
    e.preventDefault();

    const res = await fetch("http://127.0.0.1:5000/api/projects/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        category: form.category,
        stage: form.stage,
        skillsNeeded: form.skillsNeeded
          .split(",")
          .map(s => s.trim())
          .filter(Boolean)
      })
    });

    const data = await res.json();

    // instant UI update
    setProjects(prev => [
      ...prev,
      {
        _id: data.project_id,
        title: form.title,
        description: form.description,
        category: form.category,
        stage: form.stage,
        skills_required: form.skillsNeeded.split(","),
        created_at: new Date().toISOString()
      }
    ]);

    setShowCreate(false);

    setForm({
      title: "",
      description: "",
      category: "",
      stage: "ideation",
      skillsNeeded: ""
    });
  };
const runAgents = async (project: Project) => {
  setAnalysisLoading(true);
  const token = localStorage.getItem("csh_token");
  
  try {
    const res = await fetch("http://localhost:5000/api/agents/startup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        description: project.description,
        users: []
      })
    });

    if (!res.ok) {
      throw new Error(`Error: ${res.statusText}`);
    }

    const data = await res.json();

    setAnalysisData({
      evaluation: data.evaluation || "",
      proposal: data.proposal || "",
      teamSuggestions: data.team_suggestions || "",
      projectTitle: project.title
    });
  } catch (error) {
    console.error("Failed to run agents:", error);
    alert("Failed to run AI agents. Please try again.");
  } finally {
    setAnalysisLoading(false);
  }
};

  return (
    <>
      {analysisData ? (
        <AgentAnalysisPage
          projectTitle={analysisData.projectTitle}
          evaluation={analysisData.evaluation}
          proposal={analysisData.proposal}
          teamSuggestions={analysisData.teamSuggestions}
          onBack={() => setAnalysisData(null)}
        />
      ) : (
        <div className="projects-page">
          <div className="projects-header">
            <h1>My Projects</h1>
            <button
              className="new-project-btn"
              onClick={() => setShowCreate(!showCreate)}
            >
              + New Project
            </button>
          </div>

          {loading && <p className="empty-text">Loading projects...</p>}

          {!loading && projects.length === 0 && (
            <p className="empty-text">No projects yet. Create one!</p>
          )}

          {/* CREATE FORM */}
          {showCreate && (
            <form className="create-form" onSubmit={createProject}>
              <input
                placeholder="Title"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                required
              />

              <input
                placeholder="Description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                required
              />

              <input
                placeholder="Category"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                required
              />

              <input
                placeholder="Skills (comma separated)"
                value={form.skillsNeeded}
                onChange={e => setForm({ ...form, skillsNeeded: e.target.value })}
              />

              <select
                value={form.stage}
                onChange={e => setForm({ ...form, stage: e.target.value })}
              >
                <option value="ideation">Ideation</option>
                <option value="prototype">Prototype</option>
                <option value="launched">Launched</option>
              </select>

              <button type="submit">Create</button>
            </form>
          )}

          {/* PROJECT LIST */}
          <div className="projects-grid">
            {projects.map(p => (
              <div key={p._id} className="project-card">
                <h3>{p.title}</h3>
                <p>{p.description}</p>

                <div className="project-meta">
                  <span className="stage">{p.stage}</span>
                  <span className="category">{p.category}</span>
                </div>

                <div className="skills">
                  {p.skills_required?.map(skill => (
                    <span key={skill} className="skill-tag">
                      {skill}
                    </span>
                  ))}
                </div>
                <button
                  className="ai-agent-btn"
                  onClick={() => runAgents(p)}
                  disabled={analysisLoading}
                >
                  {analysisLoading ? '🔄 Analyzing...' : '🚀 Run AI Startup Agents'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
