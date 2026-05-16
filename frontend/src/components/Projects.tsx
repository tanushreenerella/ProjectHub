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

<<<<<<< HEAD
    fetch(`{import.meta.env.VITE_API_URL}/api/projects/my`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setProjects(data.projects || []);
=======
    return () => {
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setProjectError("No auth token found. Please sign in again.");
      return;
    }

    let timedOut = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);

    fetch(`${import.meta.env.VITE_API_URL}/api/projects/my`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorBody = await res.text().catch(() => "");
          throw new Error(errorBody || `Failed to load projects (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        const transformedProjects: Project[] = (data.projects || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          category: p.category || "",
          skillsNeeded: p.skillsNeeded || [],
          creatorId: p.owner_id,
          createdAt: new Date(p.created_at || Date.now()),
          team_members: p.team_members,
          owner_id: p.owner_id
        }));
        setProjects(transformedProjects);
        transformedProjects.forEach((project: any, index: number) => {
          const source = (data.projects || [])[index] || {};
          saveProjectSettings(project.id, {
            status: source.workspace_status || "active",
            priority: source.workspace_priority || "medium",
            startDate: source.start_date ? String(source.start_date).slice(0, 10) : "",
            endDate: source.end_date ? String(source.end_date).slice(0, 10) : "",
            notes: source.notes || ""
          });
        });
        setProjectError("");
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") {
          if (timedOut) {
            setProjectError("Project request timed out. Make sure your backend is running on http://localhost:10000.");
          }
          // Cleanup abort (component unmount) — silently ignore
          return;
        }
        console.error("Projects fetch failed:", error);
        setProjectError(error.message || "Failed to load projects.");
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
>>>>>>> f532cff (Backup working local frontend backend setup)
        setLoading(false);
      });
  }, []);

<<<<<<< HEAD
  const createProject = async (e: any) => {
=======
    fetch(`${import.meta.env.VITE_API_URL}/api/projects/invites/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : { invites: [] }))
      .then((data) => {
        setMyInvites(
          (data.invites || []).map((invite: any) => ({
            id: invite.id,
            projectId: invite.project_id,
            projectTitle: invite.project_title,
            projectDescription: invite.project_description,
            email: invite.email,
            role: invite.role,
            invitedAt: invite.invited_at
          }))
        );
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to load project invites:", err);
        }
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [token]);
   useEffect(() => {
  if (!projects.length) return;

  const pendingProjectId = localStorage.getItem("projecthub_open_project_id");
  if (!pendingProjectId) return;

  const targetProject = projects.find((project) => project.id === pendingProjectId);
  if (!targetProject) return;

  localStorage.removeItem("projecthub_open_project_id");
  void openWorkspace(targetProject);
}, [projects]);

  const completed = tasks.filter((task) => task.status === "done").length;
  const inProgress = tasks.filter((task) => task.status === "in_progress").length;
  const todo = tasks.filter((task) => task.status === "todo").length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const overdueCount = tasks.filter((task) => {
    if (!task.dueDate || task.status === "done") return false;
    return new Date(task.dueDate) < new Date();
  }).length;

  const filteredWorkspaceTasks = useMemo(() => {
    return tasks.filter((task) => {
      const query = workspaceSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.assigneeName.toLowerCase().includes(query);

      const matchesStatus = taskFilterStatus === "all" || task.status === taskFilterStatus;
      const matchesType = taskFilterType === "all" || task.type === taskFilterType;
      const matchesPriority = taskFilterPriority === "all" || task.priority === taskFilterPriority;

      return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });
  }, [taskFilterPriority, taskFilterStatus, taskFilterType, tasks, workspaceSearch]);

  const upcomingTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => task.dueDate)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [tasks]);

  const taskTypeCounts = useMemo(() => {
    return {
      task: tasks.filter((task) => task.type === "task").length,
      feature: tasks.filter((task) => task.type === "feature").length,
      improvement: tasks.filter((task) => task.type === "improvement").length
    };
  }, [tasks]);

  const calendar = useMemo(() => buildCalendarDays(tasks, calendarViewDate), [calendarViewDate, tasks]);

  const selectedCalendarTasks = useMemo(() => {
    return tasks
      .filter((task) => task.dueDate === selectedCalendarDate)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [selectedCalendarDate, tasks]);

  const visibleProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    return projects.filter((project) => {
      if (!query) return true;
      return (
        project.title.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        project.category.toLowerCase().includes(query)
      );
    });
  }, [projectSearch, projects]);

  const activeProjects = projects.filter((project) => {
    const settings = getProjectSettingsMap()[project.id];
    return !settings || settings.status === "active";
  }).length;

  const hydrateTask = (task: Task, memberList: TeamMember[]): WorkspaceTask => {
    const taskMeta = getTaskMetaMap()[task.id] || {};
    const rawTask = task as Task & {
      description?: string;
      type?: string;
      priority?: string;
      assignee_id?: string;
      assignee_name?: string;
      due_date?: string;
    };
    const assigneeId = String(rawTask.assignee_id || taskMeta.assigneeId || task.created_by || memberList[0]?.id || "");
    const assignee = memberList.find((member) => member.id === assigneeId);

    return {
      ...task,
      description: String(rawTask.description || taskMeta.description || "Add execution notes, blockers, and next steps here."),
      type: (rawTask.type as TaskType) || (taskMeta.type as TaskType) || inferTaskType(task.title),
      priority: (rawTask.priority as TaskPriority) || (taskMeta.priority as TaskPriority) || inferPriority(task.title),
      assigneeId,
      assigneeName: String(rawTask.assignee_name || assignee?.name || taskMeta.assigneeName || "Unassigned"),
      dueDate: String(rawTask.due_date || taskMeta.dueDate || "")
    };
  };

  const createProject = async (e: React.FormEvent<HTMLFormElement>) => {
>>>>>>> f532cff (Backup working local frontend backend setup)
    e.preventDefault();

    const res = await fetch(`{import.meta.env.VITE_API_URL}/api/projects/`, {
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
    const res = await fetch(`{import.meta.env.VITE_API_URL}/api/agents/startup`, {
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
