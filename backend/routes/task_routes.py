from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from datetime import datetime
from extensions import tasks_collection

tasks_bp = Blueprint("tasks", __name__)


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
        "status": "todo",
        "created_by": ObjectId(user_id),
        "created_at": datetime.utcnow()
    }

    tid = tasks_collection.insert_one(task).inserted_id

    return jsonify({
        "msg": "Task created",
        "task_id": str(tid)
    })


# Get tasks for a project
@tasks_bp.route("/project/<project_id>", methods=["GET", "OPTIONS"])
def get_tasks(project_id):

    if request.method == "OPTIONS":
        return jsonify({}), 200

    tasks = list(tasks_collection.find({
        "project_id": ObjectId(project_id)
    }))

    result = []

    for t in tasks:
        result.append({
            "id": str(t["_id"]),
            "title": t["title"],
            "status": t["status"]
        })

    return jsonify({"tasks": result})


# Update task status
@tasks_bp.route("/<task_id>/status", methods=["PUT", "OPTIONS"])
def update_status(task_id):

    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.json

    tasks_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {"status": data["status"]}}
    )

    return jsonify({"msg": "Task updated"})