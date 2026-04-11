from datetime import datetime
from bson.objectid import ObjectId
from extensions import notifications_collection, socketio

def create_notification(user_id, notif_type, title, message, project_id=None, actor_id=None, actor_name=""):
    notification = {
        "user_id": ObjectId(user_id),
        "type": notif_type,
        "title": title,
        "message": message,
        "read": False,
        "project_id": ObjectId(project_id) if project_id else None,
        "actor_id": ObjectId(actor_id) if actor_id else None,
        "actor_name": actor_name or "",
        "created_at": datetime.utcnow()
    }

    inserted_id = notifications_collection.insert_one(notification).inserted_id

    socketio.emit(
        "notification_created",
        {
            "id": str(inserted_id),
            "user_id": str(user_id),
            "type": notif_type,
            "title": title,
            "message": message,
            "project_id": str(project_id) if project_id else "",
            "actor_id": str(actor_id) if actor_id else "",
            "actor_name": actor_name or "",
            "read": False,
            "created_at": notification["created_at"].isoformat()
        },
        room=f"user:{user_id}"
    )
