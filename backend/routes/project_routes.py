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
    "team_members": ObjectId(user_id),
    "archived": {"$ne": True}
}).sort("created_at", -1))


    result = []

    for p in projects:
        result.append(_serialize_project(p))

    return jsonify({"projects": result})


# Get All Projects (for discovery)
@project_bp.route("/all", methods=["GET"])
@jwt_required()
def get_all_projects():

    projects = list(projects_collection.find({
    "archived": {"$ne": True}
}).sort("created_at", -1))


    result = []

    for p in projects:
        result.append(_serialize_project(p))

    return jsonify({"projects": result})


@project_bp.route("/<project_id>/workspace-settings", methods=["PUT"])
@jwt_required()
def update_workspace_settings(project_id):

    user_id = get_jwt_identity()
    data = request.json or {}

    project = projects_collection.find_one({
        "_id": ObjectId(project_id),
        "team_members": ObjectId(user_id)
    })

    if not project:
        return jsonify({"error": "Project not found"}), 404

    updates = {
        "workspace_status": data.get("status", project.get("workspace_status", "active")),
        "workspace_priority": data.get("priority", project.get("workspace_priority", "medium")),
        "start_date": _parse_optional_date(data.get("startDate")) if "startDate" in data else project.get("start_date"),
        "end_date": _parse_optional_date(data.get("endDate")) if "endDate" in data else project.get("end_date"),
        "notes": data.get("notes", project.get("notes", ""))
    }

    projects_collection.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": updates}
    )

    user = _get_current_user()
    _log_project_activity(
        project_id,
        "settings_updated",
        actor_id=user_id,
        actor_name=user.get("name", "") if user else "",
        message="Updated workspace settings"
    )
    _emit_workspace_update(project_id, "settings_updated", "Workspace settings updated")

    updated = projects_collection.find_one({"_id": ObjectId(project_id)})
    return jsonify({"project": _serialize_project(updated)})


@project_bp.route("/<project_id>/invites", methods=["GET"])
@jwt_required()
def get_project_invites(project_id):

    user_id = get_jwt_identity()
    project = projects_collection.find_one({
        "_id": ObjectId(project_id),
        "team_members": ObjectId(user_id)
    })

    if not project:
        return jsonify({"error": "Project not found"}), 404

    invites = list(project_invites_collection.find({
        "project_id": ObjectId(project_id),
        "status": "pending"
    }).sort("invited_at", -1))

    return jsonify({"invites": [_serialize_invite(invite) for invite in invites]})


@project_bp.route("/<project_id>/invites", methods=["POST"])
@jwt_required()
def create_project_invite(project_id):

    user_id = get_jwt_identity()
    data = request.json or {}

    project = projects_collection.find_one({
        "_id": ObjectId(project_id),
        "team_members": ObjectId(user_id)
    })

    if not project:
        return jsonify({"error": "Project not found"}), 404

    email = str(data.get("email", "")).strip().lower()
    role = data.get("role", "member")

    if not email or "@" not in email:
        return jsonify({"error": "Valid email is required"}), 400

    existing_user = users_collection.find_one({"email": email})
    if existing_user and existing_user["_id"] in project.get("team_members", []):
        return jsonify({"error": "User is already in the team"}), 409

    existing_invite = project_invites_collection.find_one({
        "project_id": ObjectId(project_id),
        "email": email,
        "status": "pending"
    })

    if existing_invite:
        return jsonify({"error": "Invitation already sent"}), 409

    invite = {
        "project_id": ObjectId(project_id),
        "email": email,
        "role": role,
        "status": "pending",
        "invited_at": datetime.utcnow(),
        "invited_by": ObjectId(user_id)
    }

    invite_id = project_invites_collection.insert_one(invite).inserted_id
    invite["_id"] = invite_id
    user = _get_current_user()
    _log_project_activity(
        project_id,
        "invite_sent",
        actor_id=user_id,
        actor_name=user.get("name", "") if user else "",
        message=f"Invited {email} as {role}",
        metadata={"email": email, "role": role}
    )
    _emit_workspace_update(project_id, "invite_sent", f"Invited {email}")
    create_notification(
        str(project["owner_id"]),
        "project_invite_sent",
        "Project invite sent",
        f"You invited {email} to {project.get('title', 'your project')}",
        project_id=project_id,
        actor_id=user_id,
        actor_name=user.get("name", "") if user else ""
    )
    if existing_user:
        create_notification(
            str(existing_user["_id"]),
            "project_invite_received",
            "Project invitation received",
            f"You were invited to join {project.get('title', 'a project')} as {role}",
            project_id=project_id,
            actor_id=user_id,
            actor_name=user.get("name", "") if user else ""
        )

    return jsonify({"invite": _serialize_invite(invite)}), 201


@project_bp.route("/invites/me", methods=["GET"])
@jwt_required()
def get_my_project_invites():

    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    invites = list(project_invites_collection.find({
        "email": user.get("email", "").lower(),
        "status": "pending"
    }).sort("invited_at", -1))

    results = []
    for invite in invites:
        item = _serialize_invite(invite)
        project = projects_collection.find_one({"_id": invite["project_id"]})
        if project:
            item["project_title"] = project.get("title", "")
            item["project_description"] = project.get("description", "")
        results.append(item)

    return jsonify({"invites": results})


@project_bp.route("/invites/<invite_id>/accept", methods=["POST"])
@jwt_required()
def accept_project_invite(invite_id):

    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    invite = project_invites_collection.find_one({
        "_id": ObjectId(invite_id),
        "email": user.get("email", "").lower(),
        "status": "pending"
    })

    if not invite:
        return jsonify({"error": "Invitation not found"}), 404

    projects_collection.update_one(
        {"_id": invite["project_id"]},
        {"$addToSet": {"team_members": user["_id"]}}
    )
    project = projects_collection.find_one({"_id": invite["project_id"]})

    project_invites_collection.update_one(
        {"_id": ObjectId(invite_id)},
        {"$set": {"status": "accepted", "responded_at": datetime.utcnow()}}
    )

    _log_project_activity(
        invite["project_id"],
        "invite_accepted",
        actor_id=user["_id"],
        actor_name=user.get("name", ""),
        message=f"{user.get('name', 'A user')} joined the project"
    )
    _emit_workspace_update(invite["project_id"], "invite_accepted", f"{user.get('name', 'A user')} joined the project")
    if project:
        create_notification(
            str(user["_id"]),
            "project_invite_accepted",
            "You joined the project",
            f"You joined {project.get('title', 'the project')}",
            project_id=str(project["_id"]),
            actor_id=str(user["_id"]),
            actor_name=user.get("name", "")
        )
        if str(project.get("owner_id")) != str(user["_id"]):
            create_notification(
                str(project["owner_id"]),
                "project_member_joined",
                "A member joined your project",
                f"{user.get('name', 'A user')} joined {project.get('title', 'your project')}",
                project_id=str(project["_id"]),
                actor_id=str(user["_id"]),
                actor_name=user.get("name", "")
            )

    return jsonify({"msg": "Invitation accepted"})


@project_bp.route("/invites/<invite_id>/reject", methods=["POST"])
@jwt_required()
def reject_project_invite(invite_id):

    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    invite = project_invites_collection.find_one({
        "_id": ObjectId(invite_id),
        "email": user.get("email", "").lower(),
        "status": "pending"
    })

    if not invite:
        return jsonify({"error": "Invitation not found"}), 404

    project_invites_collection.update_one(
        {"_id": ObjectId(invite_id)},
        {"$set": {"status": "rejected", "responded_at": datetime.utcnow()}}
    )

    _log_project_activity(
        invite["project_id"],
        "invite_rejected",
        actor_id=user["_id"],
        actor_name=user.get("name", ""),
        message=f"{user.get('name', 'A user')} rejected the invitation"
    )
    _emit_workspace_update(invite["project_id"], "invite_rejected", f"{user.get('name', 'A user')} rejected the invitation")
    project = projects_collection.find_one({"_id": invite["project_id"]})
    if project:
        create_notification(
            str(project["owner_id"]),
            "project_invite_rejected",
            "Project invite rejected",
            f"{user.get('name', 'A user')} declined the invite to {project.get('title', 'your project')}",
            project_id=str(project["_id"]),
            actor_id=str(user["_id"]),
            actor_name=user.get("name", "")
        )

    return jsonify({"msg": "Invitation rejected"})


# Join Project
@project_bp.route("/<project_id>/join", methods=["POST"])
@jwt_required()
def join_project(project_id):

    user_id = get_jwt_identity()

    project = projects_collection.find_one({
        "_id": ObjectId(project_id)
    })

    if not project:
        return jsonify({"error": "Project not found"}), 404

    # Prevent duplicate joins
    if ObjectId(user_id) in project.get("team_members", []):
        return jsonify({"msg": "Already a member"})

    projects_collection.update_one(
        {"_id": ObjectId(project_id)},
        {"$addToSet": {"team_members": ObjectId(user_id)}}
    )
    actor = _get_current_user()
    _log_project_activity(
        project_id,
        "member_joined",
        actor_id=user_id,
        actor_name=actor.get("name", "") if actor else "",
        message=f"{actor.get('name', 'A user') if actor else 'A user'} joined the project"
    )
    _emit_workspace_update(project_id, "member_joined", "A new member joined the project")
    create_notification(
        user_id,
        "project_joined",
        "You joined a project",
        f"You joined {project.get('title', 'a project')}",
        project_id=project_id,
        actor_id=user_id,
        actor_name=actor.get("name", "") if actor else ""
    )
    if str(project.get("owner_id")) != str(user_id):
        create_notification(
            str(project["owner_id"]),
            "member_joined_project",
            "New member joined your project",
            f"{actor.get('name', 'A user') if actor else 'A user'} joined {project.get('title', 'your project')}",
            project_id=project_id,
            actor_id=user_id,
            actor_name=actor.get("name", "") if actor else ""
        )

    return jsonify({"msg": "Joined project successfully"})


# Get Project Members
@project_bp.route("/<project_id>/members", methods=["GET"])
@jwt_required()
def get_project_members(project_id):

    project = projects_collection.find_one({
        "_id": ObjectId(project_id)
    })

    if not project:
        return jsonify({"error": "Project not found"}), 404

    members = []

    for uid in project.get("team_members", []):

        user = users_collection.find_one({"_id": uid})

        if user:
            members.append({
                "id": str(user["_id"]),
                "name": user.get("name", "Unknown"),
                "skills": user.get("skills", []),
                "bio": user.get("bio", "")
            })

    return jsonify({"members": members})


@project_bp.route("/<project_id>/members/<member_id>", methods=["DELETE"])
@jwt_required()
def remove_project_member(project_id, member_id):

    user_id = get_jwt_identity()
    project = projects_collection.find_one({"_id": ObjectId(project_id)})

    if not project:
        return jsonify({"error": "Project not found"}), 404

    if str(project.get("owner_id")) != str(user_id):
        return jsonify({"error": "Only the project owner can remove members"}), 403

    if str(project.get("owner_id")) == str(member_id):
        return jsonify({"error": "Project owner cannot be removed"}), 400

    projects_collection.update_one(
        {"_id": ObjectId(project_id)},
        {"$pull": {"team_members": ObjectId(member_id)}}
    )

    removed_user = users_collection.find_one({"_id": ObjectId(member_id)})
    actor = _get_current_user()
    _log_project_activity(
        project_id,
        "member_removed",
        actor_id=user_id,
        actor_name=actor.get("name", "") if actor else "",
        message=f"Removed {removed_user.get('name', 'member') if removed_user else 'member'} from the project"
    )
    _emit_workspace_update(project_id, "member_removed", "Project member removed")
    if removed_user:
        create_notification(
            str(removed_user["_id"]),
            "project_member_removed",
            "You were removed from a project",
            f"You were removed from {project.get('title', 'a project')}",
            project_id=project_id,
            actor_id=user_id,
            actor_name=actor.get("name", "") if actor else ""
        )

    return jsonify({"msg": "Member removed"})


@project_bp.route("/<project_id>/activity", methods=["GET"])
@jwt_required()
def get_project_activity(project_id):

    user_id = get_jwt_identity()
    project = projects_collection.find_one({
        "_id": ObjectId(project_id),
        "team_members": ObjectId(user_id)
    })

    if not project:
        return jsonify({"error": "Project not found"}), 404

    activity = list(project_activity_collection.find({
        "project_id": ObjectId(project_id)
    }).sort("created_at", -1).limit(50))

    return jsonify({"activity": [_serialize_activity(item) for item in activity]})
@project_bp.route("/<project_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def delete_project(project_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    user_id = get_jwt_identity()

    project = projects_collection.find_one({"_id": ObjectId(project_id)})
    if not project:
        return jsonify({"error": "Project not found"}), 404

    if str(project["owner_id"]) != str(user_id):
        return jsonify({"error": "Only project owner can delete project"}), 403

    actor = _get_current_user()
    _log_project_activity(
        project_id,
        "project_deleted",
        actor_id=user_id,
        actor_name=actor.get("name", "") if actor else "",
        message=f"Deleted project {project.get('title', '')}"
    )
    _emit_workspace_update(project_id, "project_deleted", f"Deleted project {project.get('title', '')}")
    projects_collection.delete_one({"_id": ObjectId(project_id)})

    return jsonify({"msg": "Project deleted"})
@project_bp.route("/<project_id>/archive", methods=["PUT", "OPTIONS"])
@jwt_required()
def archive_project(project_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    user_id = get_jwt_identity()

    project = projects_collection.find_one({"_id": ObjectId(project_id)})
    if not project:
        return jsonify({"error": "Project not found"}), 404

    if str(project["owner_id"]) != str(user_id):
        return jsonify({"error": "Only project owner can archive project"}), 403

    projects_collection.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": {"archived": True, "archived_at": datetime.utcnow()}}
    )
    actor = _get_current_user()
    _log_project_activity(
        project_id,
        "project_archived",
        actor_id=user_id,
        actor_name=actor.get("name", "") if actor else "",
        message=f"Archived project {project.get('title', '')}"
    )
    _emit_workspace_update(project_id, "project_archived", f"Archived project {project.get('title', '')}")

    return jsonify({"msg": "Project archived"})