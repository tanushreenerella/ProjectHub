from datetime import datetime, timedelta
from extensions import projects_collection, project_activity_collection, notifications_collection
from utils.notifications import create_notification


def send_inactivity_reminders(days_without_activity=3, reminder_cooldown_hours=24):
    now = datetime.utcnow()
    activity_cutoff = now - timedelta(days=days_without_activity)
    reminder_cutoff = now - timedelta(hours=reminder_cooldown_hours)

    projects = list(projects_collection.find({
        "archived": {"$ne": True}
    }))

    reminders_sent = 0

    for project in projects:
        project_id = project["_id"]
        owner_id = project.get("owner_id")
        title = project.get("title", "your project")

        if not owner_id:
            continue

        recent_activity = project_activity_collection.find_one({
            "project_id": project_id,
            "created_at": {"$gte": activity_cutoff}
        })

        if recent_activity:
            continue

        recent_reminder = notifications_collection.find_one({
            "user_id": owner_id,
            "type": "project_inactive_reminder",
            "project_id": project_id,
            "created_at": {"$gte": reminder_cutoff}
        })

        if recent_reminder:
            continue

        create_notification(
            str(owner_id),
            "project_inactive_reminder",
            "Project needs attention",
            f"No recent activity in {title} for {days_without_activity} days. Keep the momentum going.",
            project_id=str(project_id)
        )

        reminders_sent += 1

    return {"reminders_sent": reminders_sent}
