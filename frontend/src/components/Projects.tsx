import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import "./Projects.css";
import AgentAnalysisPage from "./AgentAnalysisPage";
import type { Project, Task, TeamMember } from "../types";
import { AIService } from "../services/aiService";
interface AnalysisData {
  evaluation: string;
  proposal: string;
  teamSuggestions: string;
  projectTitle: string;
}

type WorkspaceTab = "overview" | "tasks" | "calendar" | "analytics" | "team" | "settings";
type TaskType = "task" | "feature" | "improvement";
type TaskPriority = "low" | "medium" | "high";
type ProjectStatus = "active" | "planning" | "completed" | "on_hold";
interface ProjectCopilotAnalysis {
  summary: string;
  healthScore: number;
  risks: string[];
  nextSteps: string[];
  teamInsights: string[];
  fundingReadiness: string;
}
interface WorkspaceTask extends Task {
  description: string;
  type: TaskType;
  priority: TaskPriority;
  assigneeId: string;
  assigneeName: string;
  dueDate: string;
}

interface ProjectSettings {
  status: ProjectStatus;
  priority: TaskPriority;
  startDate: string;
  endDate: string;
  notes: string;
}

interface TaskFormState {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  status: Task["status"];
}

interface ProjectInvite {
  id: string;
  projectId?: string;
  projectTitle?: string;
  projectDescription?: string;
  email: string;
  role: "member" | "lead" | "viewer";
  invitedAt: string;
}

interface ProjectActivityItem {
  id: string;
  eventType: string;
  actorName: string;
  message: string;
  createdAt: string;
}

const TASK_META_KEY = "projecthub_task_meta";
const PROJECT_SETTINGS_KEY = "projecthub_project_settings";

const defaultTaskForm = (): TaskFormState => ({
  title: "",
  description: "",
  type: "task",
  priority: "medium",
  assigneeId: "",
  dueDate: "",
  status: "todo"
});

const defaultProjectSettings = (): ProjectSettings => ({
  status: "active",
  priority: "medium",
  startDate: "",
  endDate: "",
  notes: ""
});

const getTaskMetaMap = (): Record<string, Partial<WorkspaceTask>> => {
  try {
    return JSON.parse(localStorage.getItem(TASK_META_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveTaskMeta = (taskId: string, meta: Partial<WorkspaceTask>) => {
  const existing = getTaskMetaMap();
  existing[taskId] = { ...(existing[taskId] || {}), ...meta };
  localStorage.setItem(TASK_META_KEY, JSON.stringify(existing));
};

const getProjectSettingsMap = (): Record<string, ProjectSettings> => {
  try {
    return JSON.parse(localStorage.getItem(PROJECT_SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveProjectSettings = (projectId: string, settings: ProjectSettings) => {
  const existing = getProjectSettingsMap();
  existing[projectId] = settings;
  localStorage.setItem(PROJECT_SETTINGS_KEY, JSON.stringify(existing));
};

const inferTaskType = (title: string): TaskType => {
  const value = title.toLowerCase();
  if (value.includes("feature")) return "feature";
  if (value.includes("improve") || value.includes("fix") || value.includes("refactor")) return "improvement";
  return "task";
};

const inferPriority = (title: string): TaskPriority => {
  if (title.length > 28) return "high";
  if (title.length > 18) return "medium";
  return "low";
};

const statusLabel = (status: Task["status"]) => {
  if (status === "in_progress") return "In Progress";
  if (status === "done") return "Done";
  return "To Do";
};

const formatTaskType = (type: TaskType) => type.charAt(0).toUpperCase() + type.slice(1);

const formatCompactDate = (value?: string) => {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const formatActivityTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const dayNumber = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDate();
};

const buildCalendarDays = (tasks: WorkspaceTask[], currentMonth: Date) => {
  const date = new Date(currentMonth);
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startOffset = firstDay.getDay();
  const cells: Array<{ key: string; label: number | null; tasks: WorkspaceTask[]; isToday: boolean }> = [];
  const today = new Date();

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ key: `blank-${i}`, label: null, tasks: [], isToday: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const current = new Date(year, month, day);
    const currentTasks = tasks.filter((task) => {
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate);
      return due.getFullYear() === year && due.getMonth() === month && due.getDate() === day;
    });

    cells.push({
      key: `${year}-${month}-${day}`,
      label: day,
      tasks: currentTasks,
      isToday:
        current.getFullYear() === today.getFullYear() &&
        current.getMonth() === today.getMonth() &&
        current.getDate() === today.getDate()
    });
  }

  return {
    monthLabel: firstDay.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    cells
  };
};

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [myInvites, setMyInvites] = useState<ProjectInvite[]>([]);
  const [activity, setActivity] = useState<ProjectActivityItem[]>([]);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("overview");
  const [projectSearch, setProjectSearch] = useState("");
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>("");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskFormState>(defaultTaskForm());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [projectInvites, setProjectInvites] = useState<ProjectInvite[]>([]);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "member" as ProjectInvite["role"]
  });
  const [inviteStatus, setInviteStatus] = useState("");
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(defaultProjectSettings());
  const [taskFilterStatus, setTaskFilterStatus] = useState<"all" | Task["status"]>("all");
  const [taskFilterType, setTaskFilterType] = useState<"all" | TaskType>("all");
  const [taskFilterPriority, setTaskFilterPriority] = useState<"all" | TaskPriority>("all");
  const [workspaceSocket, setWorkspaceSocket] = useState<Socket | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    skillsNeeded: "",
    status: "planning",
    priority: "medium",
    startDate: "",
    endDate: ""
  });
  const [copilotAnalysis, setCopilotAnalysis] = useState<ProjectCopilotAnalysis | null>(null);
const [copilotLoading, setCopilotLoading] = useState(false);
const [showCopilotPanel, setShowCopilotPanel] = useState(false);

  const token = localStorage.getItem("csh_token");

  useEffect(() => {
    if (!token) return;
    const socket = io(`${import.meta.env.VITE_API_URL}`, {
      query: { token }
    });
    setWorkspaceSocket(socket);

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

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

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
        console.error("Projects fetch failed:", error);
        if (error.name === "AbortError") {
          setProjectError("Project request timed out. Make sure your backend is running on http://localhost:10000.");
        } else {
          setProjectError(error.message || "Failed to load projects.");
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        setLoading(false);
      });

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
      .catch((err) => console.error("Failed to load project invites:", err));
     
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
    e.preventDefault();

    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        category: form.category,
        status: form.status,
        priority: form.priority,
        start_date: form.startDate,
        end_date: form.endDate,
        skillsNeeded: form.skillsNeeded
          .split(",")
          .map((skill: string) => skill.trim())
          .filter(Boolean)
      })
    });

    const data = await res.json();
    const newProject: Project = {
      id: data.project_id,
      title: form.title,
      description: form.description,
      category: form.category,
      skillsNeeded: form.skillsNeeded.split(",").map((skill) => skill.trim()).filter(Boolean),
      creatorId: "",
      createdAt: new Date(),
      owner_id: ""
    };

    setProjects((prev) => [...prev, newProject]);
    saveProjectSettings(newProject.id, {
      status: form.status as ProjectStatus,
      priority: form.priority as TaskPriority,
      startDate: form.startDate,
      endDate: form.endDate,
      notes: ""
    });

    setShowCreate(false);
    setForm({
      title: "",
      description: "",
      category: "",
      skillsNeeded: "",
      status: "planning",
      priority: "medium",
      startDate: "",
      endDate: ""
    });
  };

  const runAgents = async (project: Project) => {
    setAnalysisLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/agents/startup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          description: project.description,
          users: []
        })
      });

      const data = await res.json();
      setAnalysisData({
        evaluation: data.evaluation || "",
        proposal: data.proposal || "",
        teamSuggestions: data.team_suggestions || "",
        projectTitle: project.title
      });
    } catch (error) {
      console.error(error);
    }

    setAnalysisLoading(false);
  };
  const handleRunProjectCopilot = async () => {
  if (!selectedProject) return;

  setCopilotLoading(true);
  setShowCopilotPanel(true);

  try {
    const result = await AIService.analyzeProjectCopilot(selectedProject.id);
    setCopilotAnalysis(result);
  } catch (error) {
    console.error("Project copilot failed:", error);
    setCopilotAnalysis({
      summary: "AI copilot could not fully analyze the project right now.",
      healthScore: 6,
      risks: [
        "Project context may be incomplete",
        "Execution clarity may still be low",
        "The current project may need stronger planning"
      ],
      nextSteps: [
        "Review current tasks and priorities",
        "Clarify the next milestone",
        "Update project notes for better context"
      ],
      teamInsights: [
        "Check whether work is clearly distributed",
        "Make sure each open task has an owner"
      ],
      fundingReadiness: "Funding readiness cannot be assessed properly until project context is more complete."
    });
  }

  setCopilotLoading(false);
};

  const openWorkspace = async (project: Project) => {
    setSelectedProject(project);
    setWorkspaceTab("overview");
    setWorkspaceSearch("");
    setTaskFilterStatus("all");
    setTaskFilterType("all");
    setTaskFilterPriority("all");

    const settingsMap = getProjectSettingsMap();
    const nextSettings = settingsMap[project.id] || defaultProjectSettings();
    setProjectSettings(nextSettings);
    setProjectInvites([]);
    setInviteStatus("");
    setActivity([]);

    try {
      const membersRes = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/${project.id}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const membersData = await membersRes.json();
      const resolvedMembers = membersData.members || [];
      setMembers(resolvedMembers);

      const tasksRes = await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/project/${project.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const tasksData = await tasksRes.json();
      const transformedTasks: WorkspaceTask[] = (tasksData.tasks || []).map((t: any) =>
        hydrateTask(
          {
            id: t.id,
            project_id: t.project_id || project.id,
            title: t.title,
            description: t.description,
            type: t.type,
            priority: t.priority,
            status: t.status as Task["status"],
            assignee_id: t.assignee_id,
            assignee_name: t.assignee_name,
            due_date: t.due_date,
            created_by: t.created_by || "",
            created_at: new Date(t.created_at || Date.now())
          } as Task & {
            description?: string;
            type?: string;
            priority?: string;
            assignee_id?: string;
            assignee_name?: string;
            due_date?: string;
          },
          resolvedMembers
        )
      );
      setTasks(transformedTasks);
      const firstTaskDate = transformedTasks.find((task) => task.dueDate)?.dueDate;
      const initialCalendarDate = firstTaskDate || nextSettings.endDate || nextSettings.startDate || new Date().toISOString().slice(0, 10);
      setSelectedCalendarDate(initialCalendarDate);
      setCalendarViewDate(new Date(initialCalendarDate));
      setTaskForm((prev) => ({
        ...prev,
        assigneeId: resolvedMembers[0]?.id || ""
      }));

      const invitesRes = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/${project.id}/invites`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const invitesData = await invitesRes.json();
      setProjectInvites(
        (invitesData.invites || []).map((invite: any) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          invitedAt: invite.invited_at
        }))
      );

      const activityRes = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/${project.id}/activity`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const activityData = await activityRes.json();
      setActivity(
        (activityData.activity || []).map((item: any) => ({
          id: item.id,
          eventType: item.event_type,
          actorName: item.actor_name,
          message: item.message,
          createdAt: item.created_at
        }))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const createTask = async () => {
    if (!selectedProject || !taskForm.title.trim()) return;

    if (editingTaskId) {
      await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/${editingTaskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.description,
          type: taskForm.type,
          priority: taskForm.priority,
          status: taskForm.status,
          assignee_id: taskForm.assigneeId || "",
          assignee_name: members.find((member) => member.id === taskForm.assigneeId)?.name || "",
          due_date: taskForm.dueDate || ""
        })
      });

      setShowTaskModal(false);
      setEditingTaskId(null);
      setTaskForm(defaultTaskForm());
      openWorkspace(selectedProject);
      return;
    }

    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        project_id: selectedProject.id,
        title: taskForm.title,
        description: taskForm.description,
        type: taskForm.type,
        priority: taskForm.priority,
        status: taskForm.status,
        assignee_id: taskForm.assigneeId || "",
        assignee_name: members.find((member) => member.id === taskForm.assigneeId)?.name || "",
        due_date: taskForm.dueDate || ""
      })
    });

    const data = await res.json();
    const taskId = data.task_id;
    const assignee = members.find((member) => member.id === taskForm.assigneeId);

    saveTaskMeta(taskId, {
      description: taskForm.description,
      type: taskForm.type,
      priority: taskForm.priority,
      assigneeId: taskForm.assigneeId,
      assigneeName: assignee?.name || "Unassigned",
      dueDate: taskForm.dueDate
    });

    setShowTaskModal(false);
    setEditingTaskId(null);
    setTaskForm(defaultTaskForm());
    openWorkspace(selectedProject);
  };

  const updateTask = async (taskId: string, status: Task["status"]) => {
    await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/${taskId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));
  };

  const startEditTask = (task: WorkspaceTask) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      assigneeId: task.assigneeId || "",
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : "",
      status: task.status
    });
    setShowTaskModal(true);
  };

  const fetchAllProjects = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
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
      setAllProjects(transformedProjects);
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
    } catch (err) {
      console.error("Error fetching all projects:", err);
    }
  };

  const joinProject = async (projectId: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/${projectId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      alert(data.msg || "Joined project successfully!");
      window.location.reload();
    } catch (err) {
      console.error("Error joining project:", err);
      alert("Error joining project");
    }
  };

  const removeMember = async (memberId: string) => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/${selectedProject.id}/members/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to remove member");
      openWorkspace(selectedProject);
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  };

  const respondToInvite = async (inviteId: string, action: "accept" | "reject") => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/invites/${inviteId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to ${action} invite`);

      setMyInvites((prev) => prev.filter((invite) => invite.id !== inviteId));

      if (action === "accept") {
        window.location.reload();
      }
    } catch (err) {
      console.error(`Failed to ${action} invite:`, err);
    }
  };

  const handleProjectSettingsChange = (field: keyof ProjectSettings, value: string) => {
    const next = { ...projectSettings, [field]: value };
    setProjectSettings(next);
    if (selectedProject) {
      saveProjectSettings(selectedProject.id, next);
      fetch(`${import.meta.env.VITE_API_URL}/api/projects/${selectedProject.id}/workspace-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(next)
      }).catch((err) => console.error("Failed to persist workspace settings:", err));
    }
  };

  const handleInviteMember = () => {
    if (!selectedProject) return;
    const email = inviteForm.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setInviteStatus("Enter a valid email address.");
      return;
    }

    if (members.some((member: any) => (member.email || "").toLowerCase() === email)) {
      setInviteStatus("That person is already in the team.");
      return;
    }

    if (projectInvites.some((invite) => invite.email === email)) {
      setInviteStatus("Invitation already sent to this email.");
      return;
    }

    fetch(`${import.meta.env.VITE_API_URL}/api/projects/${selectedProject.id}/invites`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        email,
        role: inviteForm.role
      })
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to send invitation");
        }
        return data;
      })
      .then((data) => {
        const invite = data.invite;
        setProjectInvites((prev) => [
          {
            id: invite.id,
            email: invite.email,
            role: invite.role,
            invitedAt: invite.invited_at
          },
          ...prev
        ]);
        setInviteStatus("Invitation saved.");
        setInviteForm({
          email: "",
          role: "member"
        });
        window.setTimeout(() => {
          setShowInviteModal(false);
          setInviteStatus("");
        }, 900);
      })
      .catch((err: Error) => {
        setInviteStatus(err.message || "Failed to send invitation");
      });
  };

  const shiftCalendarMonth = (direction: -1 | 1) => {
    setCalendarViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  useEffect(() => {
    if (!workspaceSocket || !selectedProject) return;

    const projectId = selectedProject.id;
    workspaceSocket.emit("join_project_workspace", { project_id: projectId });

    const handleWorkspaceUpdated = (payload: { project_id: string }) => {
      if (payload.project_id !== projectId) return;
      openWorkspace(selectedProject);
    };

    workspaceSocket.on("workspace_updated", handleWorkspaceUpdated);

    return () => {
      workspaceSocket.emit("leave_project_workspace", { project_id: projectId });
      workspaceSocket.off("workspace_updated", handleWorkspaceUpdated);
    };
  }, [workspaceSocket, selectedProject]);
  const deleteTask = async (taskId: string) => {
  if (!selectedProject) return;

  await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/${taskId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  openWorkspace(selectedProject);
};

const archiveTask = async (taskId: string) => {
  if (!selectedProject) return;

  await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/${taskId}/archive`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  openWorkspace(selectedProject);
};
const archiveProject = async (projectId: string) => {
  await fetch(`${import.meta.env.VITE_API_URL}/api/projects/${projectId}/archive`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  setProjects(prev => prev.filter(project => project.id !== projectId));
};

const deleteProject = async (projectId: string) => {
  await fetch(`${import.meta.env.VITE_API_URL}/api/projects/${projectId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  setProjects(prev => prev.filter(project => project.id !== projectId));
};

  const renderWorkspaceMain = () => {
    if (!selectedProject) return null;

    if (workspaceTab === "tasks") {
      return (
        <section className="workspace-panel">
          <div className="workspace-controls">
            <input
              className="workspace-search"
              placeholder="Search tasks, assignees, or notes..."
              value={workspaceSearch}
              onChange={(e) => setWorkspaceSearch(e.target.value)}
            />
            <div className="workspace-filters">
              <select value={taskFilterStatus} onChange={(e) => setTaskFilterStatus(e.target.value as any)}>
                <option value="all">All Statuses</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <select value={taskFilterType} onChange={(e) => setTaskFilterType(e.target.value as any)}>
                <option value="all">All Types</option>
                <option value="task">Task</option>
                <option value="feature">Feature</option>
                <option value="improvement">Improvement</option>
              </select>
              <select value={taskFilterPriority} onChange={(e) => setTaskFilterPriority(e.target.value as any)}>
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="workspace-table-card">
            <div className="workspace-table workspace-table-header">
              <span>Title</span>
              <span>Type</span>
              <span>Priority</span>
              <span>Status</span>
              <span>Assignee</span>
              <span>Due Date</span>
            </div>

            {filteredWorkspaceTasks.length === 0 && (
              <div className="workspace-empty">No tasks match the current filters.</div>
            )}

            {filteredWorkspaceTasks.map((task) => (
              <div className="workspace-table" key={task.id}>
                <div className="table-title-cell">
                  <strong>{task.title}</strong>
                  <p>{task.description}</p>
                  <button className="inline-edit-btn" onClick={() => startEditTask(task)}>
                    Edit Task
                  </button>
                  <button className="inline-remove-btn" onClick={() => archiveTask(task.id)}>
  Archive
</button>
<button className="inline-remove-btn" onClick={() => deleteTask(task.id)}>
  Delete
</button>
                </div>
                <span className={`table-badge type-${task.type}`}>{formatTaskType(task.type)}</span>
                <span className={`table-badge priority-${task.priority}`}>{task.priority}</span>
                <select
                  className="task-status-select"
                  value={task.status}
                  onChange={(e) => updateTask(task.id, e.target.value as Task["status"])}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
                <span>{task.assigneeName}</span>
                <span>{formatCompactDate(task.dueDate)}</span>
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (workspaceTab === "calendar") {
      return (
        <section className="workspace-calendar-layout">
          <div className="workspace-panel">
            <div className="calendar-header">
              <h3>Task Calendar</h3>
              <div className="calendar-nav">
                <button className="workspace-secondary-btn calendar-nav-btn" onClick={() => shiftCalendarMonth(-1)}>
                  ←
                </button>
                <span>{calendar.monthLabel}</span>
                <button className="workspace-secondary-btn calendar-nav-btn" onClick={() => shiftCalendarMonth(1)}>
                  →
                </button>
              </div>
            </div>
            <div className="calendar-weekdays">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {calendar.cells.map((cell) => (
                <button
                  key={cell.key}
                  type="button"
                  className={`calendar-cell ${cell.isToday ? "today" : ""} ${cell.tasks.length ? "has-task" : ""} ${
                    cell.tasks.some((task) => task.dueDate === selectedCalendarDate) ? "selected" : ""
                  }`}
                  onClick={() => {
                    if (!cell.label || !cell.tasks.length) return;
                    const pickedTask = cell.tasks[0];
                    setSelectedCalendarDate(pickedTask.dueDate);
                  }}
                >
                  <span>{cell.label || ""}</span>
                  {cell.tasks.slice(0, 2).map((task) => (
                    <small key={task.id}>{task.title}</small>
                  ))}
                  {cell.tasks.length > 2 && <small>+{cell.tasks.length - 2} more</small>}
                </button>
              ))}
            </div>
          </div>

          <aside className="workspace-side-card">
            <h3>{selectedCalendarDate ? `Tasks on ${formatCompactDate(selectedCalendarDate)}` : "Upcoming Deadlines"}</h3>
            {!selectedCalendarDate && upcomingTasks.length === 0 && <p className="workspace-empty">No due dates scheduled yet.</p>}
            {selectedCalendarDate && selectedCalendarTasks.length === 0 && (
              <p className="workspace-empty">Select a highlighted day to inspect its tasks.</p>
            )}
            {(selectedCalendarDate ? selectedCalendarTasks : upcomingTasks).map((task) => (
              <div key={task.id} className="timeline-item">
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.assigneeName} • {statusLabel(task.status)}</p>
                </div>
                <span className={`table-badge type-${task.type}`}>{formatCompactDate(task.dueDate)}</span>
              </div>
            ))}
          </aside>
        </section>
      );
    }

    if (workspaceTab === "analytics") {
      const maxStatusCount = Math.max(todo, inProgress, completed, 1);
      const maxTypeCount = Math.max(taskTypeCounts.task, taskTypeCounts.feature, taskTypeCounts.improvement, 1);

      return (
        <section className="workspace-analytics">
          <div className="analytics-summary-grid">
            <div className="workspace-stat-card">
              <span>Completion Rate</span>
              <strong>{progress}%</strong>
            </div>
            <div className="workspace-stat-card">
              <span>Active Tasks</span>
              <strong>{inProgress}</strong>
            </div>
            <div className="workspace-stat-card">
              <span>Overdue Tasks</span>
              <strong>{overdueCount}</strong>
            </div>
            <div className="workspace-stat-card">
              <span>Team Size</span>
              <strong>{members.length}</strong>
            </div>
          </div>

          <div className="analytics-grid">
            <div className="workspace-panel">
              <h3>Tasks by Status</h3>
              {[
                { label: "To Do", value: todo, className: "bar-todo" },
                { label: "In Progress", value: inProgress, className: "bar-progress" },
                { label: "Done", value: completed, className: "bar-done" }
              ].map((item) => (
                <div key={item.label} className="chart-row">
                  <div className="chart-label">
                    <span>{item.label}</span>
                    <span>{item.value}</span>
                  </div>
                  <div className="chart-track">
                    <div className={`chart-fill ${item.className}`} style={{ width: `${(item.value / maxStatusCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="workspace-panel">
              <h3>Tasks by Type</h3>
              {[
                { label: "Task", value: taskTypeCounts.task, className: "bar-task" },
                { label: "Feature", value: taskTypeCounts.feature, className: "bar-feature" },
                { label: "Improvement", value: taskTypeCounts.improvement, className: "bar-improvement" }
              ].map((item) => (
                <div key={item.label} className="chart-row">
                  <div className="chart-label">
                    <span>{item.label}</span>
                    <span>{item.value}</span>
                  </div>
                  <div className="chart-track">
                    <div className={`chart-fill ${item.className}`} style={{ width: `${(item.value / maxTypeCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (workspaceTab === "team") {
      return (
        <section className="workspace-panel">
          <div className="team-header-row">
            <div>
              <h3>Team Members</h3>
              <p>Everyone currently attached to this project workspace.</p>
            </div>
            <button className="workspace-secondary-btn" onClick={() => setShowInviteModal(true)}>
              Invite Member
            </button>
          </div>

          <div className="team-table-card">
            <div className="workspace-table workspace-table-header">
              <span>Name</span>
              <span>Skills</span>
              <span>Role</span>
            </div>
            {members.map((member, index) => (
              <div className="workspace-table" key={member.id}>
                <div className="member-name-cell">
                  <div className="member-avatar">{member.name.charAt(0).toUpperCase()}</div>
                  <strong>{member.name}</strong>
                </div>
                <span>{member.skills?.join(", ") || "No skills added"}</span>
                <div className="member-role-actions">
                  <span className="table-badge member-role">{index === 0 ? "Lead" : "Member"}</span>
                  {index !== 0 && (
                    <button className="inline-remove-btn" onClick={() => removeMember(member.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!!projectInvites.length && (
            <div className="invite-list-card">
              <h3>Pending Invitations</h3>
              <div className="invite-list">
                {projectInvites.map((invite) => (
                  <div className="invite-row" key={invite.id}>
                    <div>
                      <strong>{invite.email}</strong>
                      <p>Sent {new Date(invite.invitedAt).toLocaleDateString()}</p>
                    </div>
                    <span className="table-badge member-role">{invite.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      );
    }

    if (workspaceTab === "settings") {
      return (
        <section className="workspace-settings-grid">
          <div className="workspace-panel">
            <h3>Project Details</h3>
            <div className="settings-form-grid">
              <label>
                <span>Project Name</span>
                <input value={selectedProject.title} readOnly />
              </label>
              <label className="settings-span-2">
                <span>Description</span>
                <textarea value={selectedProject.description} readOnly rows={5} />
              </label>
              <label>
                <span>Status</span>
                <select
                  value={projectSettings.status}
                  onChange={(e) => handleProjectSettingsChange("status", e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="planning">Planning</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select
                  value={projectSettings.priority}
                  onChange={(e) => handleProjectSettingsChange("priority", e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label>
                <span>Start Date</span>
                <input
                  type="date"
                  value={projectSettings.startDate}
                  onChange={(e) => handleProjectSettingsChange("startDate", e.target.value)}
                />
              </label>
              <label>
                <span>End Date</span>
                <input
                  type="date"
                  value={projectSettings.endDate}
                  onChange={(e) => handleProjectSettingsChange("endDate", e.target.value)}
                />
              </label>
              <label className="settings-span-2">
                <span>Workspace Notes</span>
                <textarea
                  rows={5}
                  value={projectSettings.notes}
                  onChange={(e) => handleProjectSettingsChange("notes", e.target.value)}
                  placeholder="Store sprint notes, blockers, release plans, or meeting summaries."
                />
              </label>
            </div>
          </div>

          <aside className="workspace-side-card">
            <h3>Team Members</h3>
            {members.map((member, index) => (
              <div className="settings-member-card" key={member.id}>
                <div>
                  <strong>{member.name}</strong>
                  <p>{member.bio || member.skills?.join(", ") || "Project teammate"}</p>
                </div>
                <span className="table-badge member-role">{index === 0 ? "Lead" : "Member"}</span>
              </div>
            ))}
          </aside>
        </section>
      );
    }

    return (
      <section className="workspace-overview-grid">
        <div className="workspace-panel workspace-overview-list">
          <div className="panel-header-row">
            <div>
              <h3>Project Overview</h3>
              <p>Track delivery status, workload, and what needs attention next.</p>
            </div>
            <button className="workspace-link-btn" onClick={() => setWorkspaceTab("tasks")}>
              View all tasks
            </button>
          </div>

          <div className="overview-project-card">
            <div className="overview-title-row">
              <div>
                <h4>{selectedProject.title}</h4>
                <p>{selectedProject.description}</p>
              </div>
              <span className={`table-badge project-status-${projectSettings.status}`}>{projectSettings.status.replace("_", " ")}</span>
            </div>
            <div className="overview-meta-row">
              <span>{members.length} members</span>
              <span>{selectedProject.category || "General"} category</span>
              <span>{projectSettings.endDate ? `Target ${formatCompactDate(projectSettings.endDate)}` : "No end date set"}</span>
            </div>
            <div className="progress-block">
              <div className="progress-label-row">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="workspace-progress">
                <div className="workspace-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="overview-columns">
            <div className="mini-panel">
              <h4>Work Breakdown</h4>
              <div className="mini-stat-list">
                <div><span>To Do</span><strong>{todo}</strong></div>
                <div><span>In Progress</span><strong>{inProgress}</strong></div>
                <div><span>Done</span><strong>{completed}</strong></div>
                <div><span>Overdue</span><strong>{overdueCount}</strong></div>
              </div>
            </div>
            <div className="mini-panel">
              <h4>Team Snapshot</h4>
              <div className="member-stack">
                {members.slice(0, 4).map((member) => (
                  <div className="member-chip" key={member.id}>
                    <div className="member-avatar">{member.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <strong>{member.name}</strong>
                      <span>{member.skills?.slice(0, 2).join(", ") || "Contributor"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="workspace-side-card">
          <h3>Upcoming Tasks</h3>
          {upcomingTasks.length === 0 && <p className="workspace-empty">Create tasks with due dates to plan your sprint.</p>}
          {upcomingTasks.map((task) => (
            <div key={task.id} className="timeline-item">
              <div className="timeline-date">
                <strong>{dayNumber(task.dueDate) || "-"}</strong>
                <span>{formatCompactDate(task.dueDate).split(" ")[0]}</span>
              </div>
              <div className="timeline-content">
                <strong>{task.title}</strong>
                <p>{task.assigneeName}</p>
              </div>
            </div>
          ))}

          <div className="activity-feed">
            <h3>Recent Activity</h3>
            {!activity.length && <p className="workspace-empty">No activity yet.</p>}
            {activity.slice(0, 6).map((item) => (
              <div key={item.id} className="activity-item">
                <strong>{item.actorName || "Workspace"}</strong>
                <p>{item.message}</p>
                <span>{formatActivityTime(item.createdAt)}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>
    );
  };

  if (analysisData) {
    return (
      <AgentAnalysisPage
        projectTitle={analysisData.projectTitle}
        evaluation={analysisData.evaluation}
        proposal={analysisData.proposal}
        teamSuggestions={analysisData.teamSuggestions}
        onBack={() => setAnalysisData(null)}
      />
    );
  }

  if (selectedProject) {
    return (
      <div className="workspace-shell">
        <aside className="workspace-sidebar">
          <button className="workspace-back-btn" onClick={() => setSelectedProject(null)}>
            ← Back to Projects
          </button>

          <div className="workspace-sidebar-card">
            <span className="workspace-sidebar-label">Workspace</span>
            <h2>{selectedProject.title}</h2>
            <p>{selectedProject.category || "Project tracking and team execution"}</p>
          </div>

          <nav className="workspace-nav">
            {[
              { id: "overview", label: "Overview" },
              { id: "tasks", label: "Tasks" },
              { id: "calendar", label: "Calendar" },
              { id: "analytics", label: "Analytics" },
              { id: "team", label: "Team" },
              { id: "settings", label: "Settings" }
            ].map((item) => (
              <button
                key={item.id}
                className={`workspace-nav-item ${workspaceTab === item.id ? "active" : ""}`}
                onClick={() => setWorkspaceTab(item.id as WorkspaceTab)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="workspace-sidebar-card">
            <h3>My Tasks</h3>
            <div className="sidebar-task-list">
              {tasks.slice(0, 5).map((task) => (
                <div className="sidebar-task-item" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>{statusLabel(task.status)}</span>
                  </div>
                  <span className={`table-badge priority-${task.priority}`}>{task.priority}</span>
                </div>
              ))}
              {!tasks.length && <p className="workspace-empty">No tasks yet.</p>}
            </div>
          </div>
        </aside>

        <div className="workspace-content">
          <header className="workspace-topbar">
  <div>
    <p className="workspace-eyebrow">Project workspace</p>
    <h1>{selectedProject.title}</h1>
  </div>

  <div className="workspace-header-actions">
    <button
      className="workspace-secondary-btn"
      onClick={handleRunProjectCopilot}
      disabled={copilotLoading}
    >
      {copilotLoading ? "Analyzing..." : "Ask AI Copilot"}
    </button>

    <button className="workspace-primary-btn" onClick={() => setShowTaskModal(true)}>
      + New Task
    </button>
  </div>
</header>


          <div className="workspace-stats-grid">
            <div className="workspace-stat-card">
              <span>Total Tasks</span>
              <strong>{tasks.length}</strong>
            </div>
            <div className="workspace-stat-card">
              <span>Completed</span>
              <strong>{completed}</strong>
            </div>
            <div className="workspace-stat-card">
              <span>In Progress</span>
              <strong>{inProgress}</strong>
            </div>
            <div className="workspace-stat-card">
              <span>Team Members</span>
              <strong>{members.length}</strong>
            </div>
          </div>

          {renderWorkspaceMain()}
          {showCopilotPanel && copilotAnalysis && (
  <div className="workspace-panel copilot-panel">
    <div className="panel-header-row">
      <div>
        <h2>AI Project Copilot</h2>
        <p>AI-generated execution and startup guidance for this workspace.</p>
      </div>
      <button className="workspace-secondary-btn" onClick={() => setShowCopilotPanel(false)}>
        Close
      </button>
    </div>

    <div className="copilot-score-card">
      <span>Project Health Score</span>
      <strong>{copilotAnalysis.healthScore}/10</strong>
    </div>

    <div className="copilot-section">
      <h3>Summary</h3>
      <p>{copilotAnalysis.summary}</p>
    </div>

    <div className="copilot-grid">
      <div className="workspace-panel">
        <h3>Risks</h3>
        <ul>
          {copilotAnalysis.risks.map((risk, index) => (
            <li key={index}>{risk}</li>
          ))}
        </ul>
      </div>

      <div className="workspace-panel">
        <h3>Next Steps</h3>
        <ul>
          {copilotAnalysis.nextSteps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ul>
      </div>

      <div className="workspace-panel">
        <h3>Team Insights</h3>
        <ul>
          {copilotAnalysis.teamInsights.map((insight, index) => (
            <li key={index}>{insight}</li>
          ))}
        </ul>
      </div>

      <div className="workspace-panel">
        <h3>Funding Readiness</h3>
        <p>{copilotAnalysis.fundingReadiness}</p>
      </div>
    </div>
  </div>
)}

        </div>

        {showInviteModal && (
          <div className="workspace-modal-overlay" onClick={() => setShowInviteModal(false)}>
            <div className="workspace-modal invite-modal" onClick={(e) => e.stopPropagation()}>
              <div className="workspace-modal-header">
                <div>
                  <h2>Invite Team Member</h2>
                  <p className="invite-modal-subtitle">
                    Inviting to workspace: <span>{selectedProject.title}</span>
                  </p>
                </div>
                <button className="close-btn" onClick={() => setShowInviteModal(false)}>×</button>
              </div>

              <div className="settings-form-grid">
                <label className="settings-span-2">
                  <span>Email Address</span>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                  />
                </label>
                <label className="settings-span-2">
                  <span>Role</span>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value as ProjectInvite["role"] }))}
                  >
                    <option value="member">Member</option>
                    <option value="lead">Lead</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
              </div>

              {!!inviteStatus && (
                <p className={`invite-status ${inviteStatus === "Invitation saved." ? "success" : "error"}`}>
                  {inviteStatus}
                </p>
              )}

              <div className="workspace-modal-actions">
                <button className="workspace-secondary-btn" onClick={() => setShowInviteModal(false)}>Cancel</button>
                <button className="workspace-primary-btn" onClick={handleInviteMember}>Send Invitation</button>
              </div>
            </div>
          </div>
        )}

        {showTaskModal && (
          <div className="workspace-modal-overlay" onClick={() => setShowTaskModal(false)}>
            <div className="workspace-modal" onClick={(e) => e.stopPropagation()}>
              <div className="workspace-modal-header">
                <h2>{editingTaskId ? "Edit Task" : "Create New Task"}</h2>
                <button className="close-btn" onClick={() => {
                  setShowTaskModal(false);
                  setEditingTaskId(null);
                  setTaskForm(defaultTaskForm());
                }}>×</button>
              </div>

              <div className="settings-form-grid">
                <label className="settings-span-2">
                  <span>Title</span>
                  <input
                    value={taskForm.title}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Task title"
                  />
                </label>
                <label className="settings-span-2">
                  <span>Description</span>
                  <textarea
                    rows={4}
                    value={taskForm.description}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the task"
                  />
                </label>
                <label>
                  <span>Type</span>
                  <select value={taskForm.type} onChange={(e) => setTaskForm((prev) => ({ ...prev, type: e.target.value as TaskType }))}>
                    <option value="task">Task</option>
                    <option value="feature">Feature</option>
                    <option value="improvement">Improvement</option>
                  </select>
                </label>
                <label>
                  <span>Priority</span>
                  <select value={taskForm.priority} onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label>
                  <span>Assignee</span>
                  <select value={taskForm.assigneeId} onChange={(e) => setTaskForm((prev) => ({ ...prev, assigneeId: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select value={taskForm.status} onChange={(e) => setTaskForm((prev) => ({ ...prev, status: e.target.value as Task["status"] }))}>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </label>
                <label className="settings-span-2">
                  <span>Due Date</span>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                  />
                </label>
              </div>

              <div className="workspace-modal-actions">
                <button className="workspace-secondary-btn" onClick={() => {
                  setShowTaskModal(false);
                  setEditingTaskId(null);
                  setTaskForm(defaultTaskForm());
                }}>Cancel</button>
                <button className="workspace-primary-btn" onClick={createTask}>
                  {editingTaskId ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="projects-page">
      <div className="projects-toolbar">
        <div>
          <p className="workspace-eyebrow">Execution Hub</p>
          <h1>My Projects</h1>
          <p className="projects-subtitle">Create, join, and manage projects from one consistent workspace.</p>
        </div>

        <div className="header-buttons">
          <button
            className="discover-btn"
            onClick={() => {
              setShowDiscover(!showDiscover);
              if (!showDiscover) fetchAllProjects();
            }}
          >
            Discover Projects
          </button>
          <button className="new-project-btn" onClick={() => setShowCreate(!showCreate)}>
            + New Project
          </button>
        </div>
      </div>

      <div className="workspace-controls projects-list-controls">
        <input
          className="workspace-search"
          placeholder="Search your projects..."
          value={projectSearch}
          onChange={(e) => setProjectSearch(e.target.value)}
        />
      </div>

      <div className="projects-summary-grid">
        <div className="workspace-stat-card">
          <span>Total Projects</span>
          <strong>{projects.length}</strong>
        </div>
        <div className="workspace-stat-card">
          <span>Visible Results</span>
          <strong>{visibleProjects.length}</strong>
        </div>
        <div className="workspace-stat-card">
          <span>Active Projects</span>
          <strong>{activeProjects}</strong>
        </div>
        <div className="workspace-stat-card">
          <span>Workspace Ready</span>
          <strong>{selectedProject ? "1" : "0"}</strong>
        </div>
      </div>

      {loading && <p className="empty-text">Loading projects...</p>}
      {!loading && projectError && <p className="projects-error">{projectError}</p>}

      {!!myInvites.length && (
        <div className="workspace-panel invites-inbox">
          <div className="panel-header-row">
            <div>
              <h3>Project Invitations</h3>
              <p>Accept an invite to join a project workspace.</p>
            </div>
          </div>

          <div className="invite-list">
            {myInvites.map((invite) => (
              <div className="invite-row" key={invite.id}>
                <div>
                  <strong>{invite.projectTitle || "Project Invite"}</strong>
                  <p>{invite.projectDescription || invite.email}</p>
                  <p>Role: {invite.role}</p>
                </div>
                <div className="invite-actions">
                  <button className="workspace-secondary-btn" onClick={() => respondToInvite(invite.id, "reject")}>
                    Reject
                  </button>
                  <button className="workspace-primary-btn" onClick={() => respondToInvite(invite.id, "accept")}>
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="workspace-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="workspace-modal" onClick={(e) => e.stopPropagation()}>
            <div className="workspace-modal-header">
              <h2>Create New Project</h2>
              <button type="button" className="close-btn" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form className="settings-form-grid" onSubmit={createProject}>
              <label className="settings-span-2">
                <span>Title</span>
                <input placeholder="Project title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </label>
              <label className="settings-span-2">
                <span>Description</span>
                <textarea rows={4} placeholder="Describe the project" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              </label>
              <label>
                <span>Category</span>
                <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
              </label>
              <label>
                <span>Skills Needed</span>
                <input placeholder="React, Design, Marketing" value={form.skillsNeeded} onChange={(e) => setForm({ ...form, skillsNeeded: e.target.value })} />
              </label>
              <label>
                <span>Status</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label>
                <span>Start Date</span>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </label>
              <label>
                <span>End Date</span>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </label>
              <div className="workspace-modal-actions settings-span-2">
                <button type="button" className="workspace-secondary-btn" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="workspace-primary-btn">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDiscover && (
        <div className="discover-section">
          <div className="panel-header-row">
            <div>
              <h2>Discover Projects</h2>
              <p>Join other active builds and expand your network.</p>
            </div>
          </div>
          <div className="projects-grid">
            {allProjects.map((project) => (
              <div key={project.id} className="project-card discover-card">
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                <div className="project-meta">
                  <span>Category: {project.category}</span>
                  <span>Skills: {project.skillsNeeded.join(", ") || "Not specified"}</span>
                </div>
                <button className="join-btn" onClick={() => joinProject(project.id)}>
                  Join Project
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="projects-grid">
        {visibleProjects.map((project) => (
          <div key={project.id} className="project-card workspace-project-card">
            <div className="overview-title-row">
              <div>
                <h3>{project.title}</h3>
                <p>{project.description}</p>
              </div>
            </div>
            <div className="project-meta">
              <span>{project.category || "General"}</span>
              <span>{project.skillsNeeded.join(", ") || "No skills listed"}</span>
            </div>
            <div className="btns">
              <button className="workspace-primary-btn" onClick={() => openWorkspace(project)}>
                Open Workspace
              </button>
              <button className="workspace-secondary-btn" onClick={() => runAgents(project)} disabled={analysisLoading}>
                Run AI Startup Agents
              </button>
              <button className="workspace-secondary-btn" onClick={() => archiveProject(project.id)}>
    Archive
  </button>
  <button className="inline-remove-btn" onClick={() => deleteProject(project.id)}>
    Delete
  </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && !projectError && visibleProjects.length === 0 && (
        <div className="workspace-panel projects-empty-state">
          <h3>No projects found</h3>
          <p>Create a project or adjust your search to see results here.</p>
        </div>
      )}
    </div>
  );
}
