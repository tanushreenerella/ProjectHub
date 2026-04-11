from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from extensions import notifications_collection
from jobs.reminders import send_inactivity_reminders
notifications_bp = Blueprint("notifications", __name__)

def _serialize_notification(notification):
    return {
        "id": str(notification["_id"]),
        "type": notification.get("type", ""),
        "title": notification.get("title", ""),
        "message": notification.get("message", ""),
        "read": notification.get("read", False),
        "project_id": str(notification["project_id"]) if notification.get("project_id") else "",
        "actor_id": str(notification["actor_id"]) if notification.get("actor_id") else "",
        "actor_name": notification.get("actor_name", ""),
        "created_at": notification["created_at"].isoformat() if notification.get("created_at") else ""
    }

@notifications_bp.route("", methods=["GET"])
@jwt_required()
def get_notifications():
    user_id = get_jwt_identity()

    notifications = list(
        notifications_collection.find({"user_id": ObjectId(user_id)})
        .sort("created_at", -1)
        .limit(50)
    )

    unread_count = notifications_collection.count_documents({
        "user_id": ObjectId(user_id),
        "read": False
    })

    return jsonify({
        "notifications": [_serialize_notification(n) for n in notifications],
        "unread_count": unread_count
    })

@notifications_bp.route("/<notification_id>/read", methods=["PUT", "OPTIONS"])
@jwt_required()
def mark_notification_read(notification_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    user_id = get_jwt_identity()

    notifications_collection.update_one(
        {
            "_id": ObjectId(notification_id),
            "user_id": ObjectId(user_id)
        },
        {"$set": {"read": True}}
    )

    return jsonify({"msg": "Notification marked as read"})

@notifications_bp.route("/read-all", methods=["PUT", "OPTIONS"])
@jwt_required()
def mark_all_notifications_read():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    user_id = get_jwt_identity()

    notifications_collection.update_many(
        {"user_id": ObjectId(user_id), "read": False},
        {"$set": {"read": True}}
    )

    return jsonify({"msg": "All notifications marked as read"})
@notifications_bp.route("/run-inactivity-check", methods=["POST", "OPTIONS"])
@jwt_required()
def run_inactivity_check():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    result = send_inactivity_reminders()
    return jsonify(result)

