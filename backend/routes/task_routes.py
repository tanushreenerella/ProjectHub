from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from datetime import datetime
from extensions import tasks_collection, users_collection, project_activity_collection, socketio
from utils.notifications import create_notification

tasks_bp = Blueprint("tasks", __name__)


def _parse_optional_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _serialize_task(task):
    return {
        "id": str(task["_id"]),
        "project_id": str(task["project_id"]) if task.get("project_id") else "",
        "title": task.get("title", ""),
        "description": task.get("description", ""),
        "type": task.get("type", "task"),
        "priority": task.get("priority", "medium"),
        "status": task.get("status", "todo"),
        "archived":task.get("archived",False),
        "assignee_id": str(task["assignee_id"]) if task.get("assignee_id") else "",
        "assignee_name": task.get("assignee_name", ""),
        "due_date": task["due_date"].isoformat() if task.get("due_date") else "",
        "created_by": str(task["created_by"]) if task.get("created_by") else "",
        "created_at": task["created_at"].isoformat() if task.get("created_at") else ""
    }


def _log_task_activity(project_id, user_id, message, event_type, metadata=None):
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    project_activity_collection.insert_one({
        "project_id": ObjectId(project_id),
        "event_type": event_type,
        "actor_id": ObjectId(user_id),
        "actor_name": user.get("name", "") if user else "",
        "message": message,
        "metadata": metadata or {},
        "created_at": datetime.utcnow()
    })


def _emit_workspace_update(project_id, event_type, message=""):
    socketio.emit(
        "workspace_updated",
        {
            "project_id": str(project_id),
            "event_type": event_type,
            "message": message
        },
        room=f"project:{project_id}"
    )


# Create task
@tasks_bp.route("/", methods=["POST", "OPTIONS"])
@jwt_required()
def create_task():

    if request.method == "OPTIONS":
        return jsonify({}), 200

    user_id = get_jwt_identity()
    data = request.json

    task = {
        "project_id": ObjectId(data["project_id"]),
        "title": data["title"],
        "description": data.get("description", ""),
        "type": data.get("type", "task"),
        "priority": data.get("priority", "medium"),
        "status": data.get("status", "todo"),
        "created_by": ObjectId(user_id),
        "assignee_id": ObjectId(data["assignee_id"]) if data.get("assignee_id") else None,
        "assignee_name": data.get("assignee_name", ""),
        "due_date": _parse_optional_date(data.get("due_date")),
        "created_at": datetime.utcnow()
    }

    tid = tasks_collection.insert_one(task).inserted_id
    _log_task_activity(
        data["project_id"],
        user_id,
        f"Created task {data['title']}",
        "task_created",
        {"task_id": str(tid), "title": data["title"]}
    )
    _emit_workspace_update(data["project_id"], "task_created", f"Created task {data['title']}")
    if task.get("assignee_id") and str(task["assignee_id"]) != str(user_id):
        create_notification(
            str(task["assignee_id"]),
            "task_assigned",
            "New task assigned",
            f"You were assigned '{task['title']}'",
            project_id=data["project_id"],
            actor_id=user_id,
            actor_name=task.get("assignee_name", "")
        )

    return jsonify({
        "msg": "Task created",
        "task_id": str(tid),
        "task": _serialize_task({**task, "_id": tid})
    })


# Get tasks for a project
@tasks_bp.route("/project/<project_id>", methods=["GET", "OPTIONS"])
@jwt_required()
def get_tasks(project_id):

    if request.method == "OPTIONS":
        return jsonify({}), 200

    tasks = list(tasks_collection.find({
    "project_id": ObjectId(project_id),
    "archived": {"$ne": True}
}))


    result = []

    for t in tasks:
        result.append(_serialize_task(t))

    return jsonify({"tasks": result})


@tasks_bp.route("/<task_id>", methods=["PUT", "OPTIONS"])
@jwt_required()
def update_task(task_id):

    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.json or {}
    updates = {}

    if "title" in data:
        updates["title"] = data.get("title", "")
    if "description" in data:
        updates["description"] = data.get("description", "")
    if "type" in data:
        updates["type"] = data.get("type", "task")
    if "priority" in data:
        updates["priority"] = data.get("priority", "medium")
    if "status" in data:
        updates["status"] = data.get("status", "todo")
    if "assignee_id" in data:
        updates["assignee_id"] = ObjectId(data["assignee_id"]) if data.get("assignee_id") else None
    if "assignee_name" in data:
        updates["assignee_name"] = data.get("assignee_name", "")
    if "due_date" in data:
        updates["due_date"] = _parse_optional_date(data.get("due_date"))

    previous = tasks_collection.find_one({"_id": ObjectId(task_id)})
    tasks_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": updates}
    )

    updated = tasks_collection.find_one({"_id": ObjectId(task_id)})
    _log_task_activity(
        str(updated["project_id"]),
        get_jwt_identity(),
        f"Updated task {updated.get('title', '')}",
        "task_updated",
        {"task_id": str(updated["_id"]), "title": updated.get("title", "")}
    )
    _emit_workspace_update(updated["project_id"], "task_updated", f"Updated task {updated.get('title', '')}")
    if updated.get("assignee_id"):
        previous_assignee = str(previous["assignee_id"]) if previous and previous.get("assignee_id") else ""
        current_assignee = str(updated["assignee_id"])
        if current_assignee != previous_assignee and current_assignee != str(get_jwt_identity()):
            actor = users_collection.find_one({"_id": ObjectId(get_jwt_identity())})
            create_notification(
                current_assignee,
                "task_assigned",
                "New task assigned",
                f"You were assigned '{updated.get('title', 'a task')}'",
                project_id=str(updated["project_id"]),
                actor_id=get_jwt_identity(),
                actor_name=actor.get("name", "") if actor else ""
            )
    return jsonify({"task": _serialize_task(updated)})


# Update task status
@tasks_bp.route("/<task_id>/status", methods=["PUT", "OPTIONS"])
@jwt_required()
def update_status(task_id):

    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.json

    tasks_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {"status": data["status"]}}
    )

    updated = tasks_collection.find_one({"_id": ObjectId(task_id)})
    _log_task_activity(
        str(updated["project_id"]),
        get_jwt_identity(),
        f"Changed task {updated.get('title', '')} to {data['status']}",
        "task_status_changed",
        {"task_id": str(updated["_id"]), "status": data["status"]}
    )
    _emit_workspace_update(updated["project_id"], "task_status_changed", f"Updated task status to {data['status']}")

    return jsonify({"msg": "Task updated"})
@tasks_bp.route("/<task_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def delete_task(task_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    task = tasks_collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        return jsonify({"error": "Task not found"}), 404

    tasks_collection.delete_one({"_id": ObjectId(task_id)})
    _log_task_activity(
        str(task["project_id"]),
        get_jwt_identity(),
        f"Deleted task {task.get('title', '')}",
        "task_deleted",
        {"task_id": str(task["_id"]), "title": task.get("title", "")}
    )
    _emit_workspace_update(task["project_id"], "task_deleted", f"Deleted task {task.get('title', '')}")

    return jsonify({"msg": "Task deleted"})
@tasks_bp.route("/<task_id>/archive", methods=["PUT", "OPTIONS"])
@jwt_required()
def archive_task(task_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    task = tasks_collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        return jsonify({"error": "Task not found"}), 404

    tasks_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {"archived": True, "archived_at": datetime.utcnow()}}
    )
    _log_task_activity(
        str(task["project_id"]),
        get_jwt_identity(),
        f"Archived task {task.get('title', '')}",
        "task_archived",
        {"task_id": str(task["_id"]), "title": task.get("title", "")}
    )
    _emit_workspace_update(task["project_id"], "task_archived", f"Archived task {task.get('title', '')}")

    return jsonify({"msg": "Task archived"})
