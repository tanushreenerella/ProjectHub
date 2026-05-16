from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from extensions import (
    users_collection,
    notifications_collection,
    match_interests_collection,
)
from datetime import datetime
from services.embedding_service import upsert_user_embedding
from services.matching_service import get_ranked_feed
from services.ai_explanation_service import get_match_explanation

matchmaking_bp = Blueprint("matchmaking", __name__)


@matchmaking_bp.route("/feed", methods=["GET"])
@jwt_required()
def get_feed():
    user_id = get_jwt_identity()
    feed_type = request.args.get("type", "teammates")

    current_user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    try:
        feed = get_ranked_feed(current_user, feed_type)

        # Attach AI explanations to top 5 user/mentor matches
        if feed_type in ("teammates", "mentors"):
            for item in feed[:5]:
                try:
                    candidate = users_collection.find_one({"_id": ObjectId(item["id"])})
                    if candidate:
                        item["ai_explanation"] = get_match_explanation(current_user, candidate)
                except Exception as e:
                    print(f"[matchmaking] explanation failed for {item['id']}: {e}")
                    item["ai_explanation"] = None

        return jsonify({"feed": feed})
    except Exception as e:
        print(f"[matchmaking] feed error: {e}")
        return jsonify({"error": str(e), "feed": []}), 500


@matchmaking_bp.route("/interest", methods=["POST"])
@jwt_required()
def express_interest():
    user_id = get_jwt_identity()
    data = request.get_json()

    target_id = data.get("target_id")
    target_type = data.get("target_type")
    action = data.get("action", "like")

    if not target_id or not target_type:
        return jsonify({"error": "target_id and target_type required"}), 400

    match_interests_collection.update_one(
        {"user_id": ObjectId(user_id), "target_id": target_id},
        {"$set": {
            "user_id": ObjectId(user_id),
            "target_id": target_id,
            "target_type": target_type,
            "action": action,
            "timestamp": datetime.utcnow(),
        }},
        upsert=True,
    )

    is_mutual = False

    if action == "like" and target_type in ("user", "mentor"):
        reverse = match_interests_collection.find_one({
            "user_id": ObjectId(target_id),
            "target_id": user_id,
            "action": "like",
        })
        is_mutual = reverse is not None

        current_user = users_collection.find_one({"_id": ObjectId(user_id)})
        current_name = current_user.get("name", "Someone") if current_user else "Someone"

        if is_mutual:
            target_user = users_collection.find_one({"_id": ObjectId(target_id)})
            target_name = target_user.get("name", "Someone") if target_user else "Someone"

            for recipient_id, sender_name in [
                (target_id, current_name),
                (user_id, target_name),
            ]:
                try:
                    notifications_collection.insert_one({
                        "user_id": ObjectId(recipient_id),
                        "type": "match_mutual",
                        "title": "It's a Match!",
                        "message": f"You and {sender_name} matched! Start a conversation.",
                        "read": False,
                        "created_at": datetime.utcnow(),
                    })
                except Exception:
                    pass
        else:
            try:
                notifications_collection.insert_one({
                    "user_id": ObjectId(target_id),
                    "type": "match_request_received",
                    "title": "New Match Request",
                    "message": f"{current_name} wants to collaborate with you on projectHub!",
                    "read": False,
                    "actor_id": user_id,
                    "created_at": datetime.utcnow(),
                })
            except Exception:
                pass

    return jsonify({"msg": "Recorded", "is_mutual": is_mutual})


@matchmaking_bp.route("/mutual", methods=["GET"])
@jwt_required()
def get_mutual_matches():
    user_id = get_jwt_identity()

    my_likes = set(
        doc["target_id"]
        for doc in match_interests_collection.find({
            "user_id": ObjectId(user_id),
            "action": "like",
            "target_type": {"$in": ["user", "mentor"]},
        })
    )

    mutual_ids = []
    for liked_id in my_likes:
        try:
            if match_interests_collection.find_one({
                "user_id": ObjectId(liked_id),
                "target_id": user_id,
                "action": "like",
            }):
                mutual_ids.append(liked_id)
        except Exception:
            pass

    matches = []
    for uid in mutual_ids:
        try:
            u = users_collection.find_one({"_id": ObjectId(uid)})
            if u:
                matches.append({
                    "id": str(u["_id"]),
                    "name": u.get("name", ""),
                    "role": u.get("role", ""),
                    "bio": u.get("bio", ""),
                    "skills": u.get("skills", []),
                    "interests": u.get("interests", []),
                })
        except Exception:
            pass

    return jsonify({"matches": matches})


@matchmaking_bp.route("/embed/refresh", methods=["POST"])
@jwt_required()
def refresh_embedding():
    user_id = get_jwt_identity()
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404
    try:
        upsert_user_embedding(user)
        return jsonify({"msg": "Embedding refreshed successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
