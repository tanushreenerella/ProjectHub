from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from datetime import datetime
from extensions import projects_collection

project_bp = Blueprint("projects", __name__)

@project_bp.route("/", methods=["POST"])
@jwt_required()
def create_project():
    user_id = get_jwt_identity()
    data = request.json

    project = {
        "title": data["title"],
        "description": data["description"],
        "category": data["category"],
        "stage": data.get("stage", "ideation"),
        "skills_required": data.get("skillsNeeded", []),  # match frontend
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
    })
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
