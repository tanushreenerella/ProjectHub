import { useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import "./Notifications.css";
type NotificationFilter = "all" | "projects" | "network" | "tasks";
interface NotificationsProps {
  userId: string;
  token: string;
  socket: Socket | null;
  onOpenNotification: (notification: NotificationItem) => void;
}


interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  project_id?: string;
  actor_id?: string;
  actor_name?: string;
  created_at: string;
}

const formatNotificationTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default function Notifications({ userId, token, socket,onOpenNotification }: NotificationsProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const filteredNotifications = useMemo(() => {
  return notifications.filter((item) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "projects") {
      return item.type.startsWith("project_") || item.type === "member_joined_project";
    }
    if (activeFilter === "network") {
      return item.type.startsWith("connection_");
    }
    if (activeFilter === "tasks") {
      return item.type.startsWith("task_");
    }
    return true;
  });
}, [activeFilter, notifications]);

const sortedNotifications = useMemo(
  () =>
    [...filteredNotifications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
  [filteredNotifications]
);


  const loadNotifications = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error("Failed to load notifications");

      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    const target = notifications.find((item) => item.id === notificationId);
    if (!target || target.read) return;

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/${notificationId}/read`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, read: true } : item
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadNotifications();
  }, [token]);

  useEffect(() => {
    if (!socket || !userId) return;

    socket.emit("join_user_notifications", { user_id: userId });

    const handleNotificationCreated = (notification: NotificationItem) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on("notification_created", handleNotificationCreated);

    return () => {
      socket.emit("leave_user_notifications", { user_id: userId });
      socket.off("notification_created", handleNotificationCreated);
    };
  }, [socket, userId]);
   const runInactivityCheck = async () => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/run-inactivity-check`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    console.log("Inactivity check result:", data);
  } catch (error) {
    console.error("Failed to run inactivity check:", error);
  }
};

  return (
    <div className="notifications-shell">
      <button
        className={`notifications-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="notifications-bell">🔔</span>
        {!!unreadCount && <span className="notifications-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notifications-panel">
          <div className="notifications-panel-header">
            <div>
              <h3>Notifications</h3>
              <p>Project, team, and network updates</p>
            </div>
            <button className="notifications-link-btn" onClick={markAllRead}>
              Mark all read
            </button>
            <button className="notifications-link-btn" onClick={runInactivityCheck}>
  Run inactivity check
</button>

          </div>
          <div className="notifications-filters">
  {[
    { id: "all", label: "All" },
    { id: "projects", label: "Projects" },
    { id: "network", label: "Network" },
    { id: "tasks", label: "Tasks" }
  ].map((filter) => (
    <button
      key={filter.id}
      className={`notifications-filter-chip ${activeFilter === filter.id ? "active" : ""}`}
      onClick={() => setActiveFilter(filter.id as NotificationFilter)}
    >
      {filter.label}
    </button>
  ))}
</div>

          <div className="notifications-list">
            {loading && <p className="notifications-empty">Loading notifications...</p>}
            {!loading && !sortedNotifications.length && (
  <p className="notifications-empty">
    {activeFilter === "all" ? "No notifications yet." : `No ${activeFilter} notifications yet.`}
  </p>
)}


            {sortedNotifications.map((item) => (
  <button
    key={item.id}
    className={`notification-card ${item.read ? "" : "unread"}`}
    onClick={async () => {
      await markAsRead(item.id);
      onOpenNotification(item);
    }}
  >
    <div className="notification-card-top">
      <strong>{item.title}</strong>
      {!item.read && <span className="notification-dot" />}
    </div>
    <p>{item.message}</p>
    <span>{formatNotificationTime(item.created_at)}</span>
  </button>
))}

          </div>
        </div>
      )}
    </div>
  );
}
