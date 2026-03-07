from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from datetime import datetime
from extensions import projects_collection, users_collection

project_bp = Blueprint("projects", __name__)


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
        "skills_required": data.get("skillsNeeded", []),
        "owner_id": ObjectId(user_id),
        "team_members": [ObjectId(user_id)],
        "funding_goal": data.get("funding_goal", 0),
        "funds_raised": 0,
        "created_at": datetime.utcnow()
    }

    pid = projects_collection.insert_one(project).inserted_id

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
        "team_members": ObjectId(user_id)
    }).sort("created_at", -1))

    result = []

    for p in projects:
        result.append({
            "id": str(p["_id"]),
            "title": p["title"],
            "description": p["description"],
            "category": p.get("category"),
            "stage": p.get("stage"),
            "skillsNeeded": p.get("skills_required", []),
            "team_members": [str(x) for x in p.get("team_members", [])],
            "owner_id": str(p["owner_id"])
        })

    return jsonify({"projects": result})


# Get All Projects (for discovery)
@project_bp.route("/all", methods=["GET"])
@jwt_required()
def get_all_projects():

    projects = list(projects_collection.find().sort("created_at", -1))

    result = []

    for p in projects:
        result.append({
            "id": str(p["_id"]),
            "title": p["title"],
            "description": p["description"],
            "category": p.get("category"),
            "stage": p.get("stage"),
            "skillsNeeded": p.get("skills_required", []),
            "team_members": [str(x) for x in p.get("team_members", [])],
            "owner_id": str(p["owner_id"])
        })

    return jsonify({"projects": result})


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