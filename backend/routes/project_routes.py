from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from datetime import datetime
from extensions import projects_collection, users_collection, project_invites_collection, project_activity_collection, socketio
from utils.notifications import create_notification
project_bp = Blueprint("projects", __name__)


def _parse_optional_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _serialize_project(project):
    return {
        "id": str(project["_id"]),
        "title": project.get("title", ""),
        "description": project.get("description", ""),
        "category": project.get("category"),
        "stage": project.get("stage"),
        "skillsNeeded": project.get("skills_required", []),
        "team_members": [str(x) for x in project.get("team_members", [])],
        "owner_id": str(project["owner_id"]),
        "archived": project.get("archived", False),
        "workspace_status": project.get("workspace_status", "active"),
        "workspace_priority": project.get("workspace_priority", "medium"),
        "start_date": project["start_date"].isoformat() if project.get("start_date") else "",
        "end_date": project["end_date"].isoformat() if project.get("end_date") else "",
        "notes": project.get("notes", "")
    }


def _serialize_invite(invite):
    return {
        "id": str(invite["_id"]),
        "project_id": str(invite["project_id"]) if invite.get("project_id") else "",
        "email": invite.get("email", ""),
        "role": invite.get("role", "member"),
        "status": invite.get("status", "pending"),
        "invited_at": invite["invited_at"].isoformat() if invite.get("invited_at") else "",
        "invited_by": str(invite["invited_by"]) if invite.get("invited_by") else ""
    }


def _get_current_user():
    user_id = get_jwt_identity()
    return users_collection.find_one({"_id": ObjectId(user_id)})


def _log_project_activity(project_id, event_type, actor_id=None, actor_name="", message="", metadata=None):
    project_activity_collection.insert_one({
        "project_id": ObjectId(project_id),
        "event_type": event_type,
        "actor_id": ObjectId(actor_id) if actor_id else None,
        "actor_name": actor_name or "Unknown",
        "message": message,
        "metadata": metadata or {},
        "created_at": datetime.utcnow()
    })


def _serialize_activity(activity):
    return {
        "id": str(activity["_id"]),
        "project_id": str(activity["project_id"]) if activity.get("project_id") else "",
        "event_type": activity.get("event_type", ""),
        "actor_id": str(activity["actor_id"]) if activity.get("actor_id") else "",
        "actor_name": activity.get("actor_name", ""),
        "message": activity.get("message", ""),
        "metadata": activity.get("metadata", {}),
        "created_at": activity["created_at"].isoformat() if activity.get("created_at") else ""
    }


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


# Create Project
@project_bp.route("/", methods=["POST"])
@jwt_required()
def create_project():

    user_id = get_jwt_identity()
    data = request.json

    project = {
        "title": data["title"],
        "description": data["description"],
        "category": data.get("category", ""),
        "stage": data.get("stage", "ideation"),
        "workspace_status": data.get("status", "active"),
        "workspace_priority": data.get("priority", "medium"),
        "start_date": _parse_optional_date(data.get("start_date")),
        "end_date": _parse_optional_date(data.get("end_date")),
        "notes": data.get("notes", ""),
        "skills_required": data.get("skillsNeeded", []),
        "owner_id": ObjectId(user_id),
        "team_members": [ObjectId(user_id)],
        "funding_goal": data.get("funding_goal", 0),
        "funds_raised": 0,
        "created_at": datetime.utcnow()
    }

    pid = projects_collection.insert_one(project).inserted_id
    _log_project_activity(
        pid,
        "project_created",
        actor_id=user_id,
        actor_name=data.get("name", ""),
        message=f"Created project {data['title']}"
    )
    _emit_workspace_update(pid, "project_created", f"Created project {data['title']}")

    return jsonify({
        "msg": "Project created",
        "project_id": str(pid)
    }), 201


# Get My Projects (owner OR team member)
@project_bp.route("/my", methods=["GET"])
@jwt_required()
def get_my_projects():

    user_id = get_jwt_identity()

    projects = list(projects_collection.find({
        "owner_id": ObjectId(user_id)
    }).sort("created_at", -1))

    for p in projects:
        p["_id"] = str(p["_id"])
        p["owner_id"] = str(p["owner_id"])
        p["team_members"] = [str(x) for x in p.get("team_members", [])]
        p["skillsNeeded"] = p.get("skills_required", [])

    return jsonify({"projects": projects})

@project_bp.route("/all", methods=["GET"])
@jwt_required()
def get_all_projects():
    projects = list(projects_collection.find().sort("created_at", -1))

    for p in projects:
        p["_id"] = str(p["_id"])
        p["owner_id"] = str(p["owner_id"])
        p["team_members"] = [str(x) for x in p.get("team_members", [])]
        p["skillsNeeded"] = p.get("skills_required", [])

    return jsonify({"projects": projects})

