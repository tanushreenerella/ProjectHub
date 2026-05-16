from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from extensions import users_collection, projects_collection, db
from datetime import datetime

matchmaking_bp = Blueprint("matchmaking", __name__)


def _score_teammate(user1, user2):
    score = 0

    skills1 = set(s.lower() for s in user1.get("skills", []))
    skills2 = set(s.lower() for s in user2.get("skills", []))
    if skills1 or skills2:
        union = len(skills1 | skills2)
        overlap = len(skills1 & skills2)
        complement = len(skills1.symmetric_difference(skills2))
        if union > 0:
            score += (overlap / union) * 15
            score += min(complement / max(union, 1), 1) * 25

    int1 = set(i.lower() for i in user1.get("interests", []))
    int2 = set(i.lower() for i in user2.get("interests", []))
    if int1 or int2:
        union = len(int1 | int2)
        if union > 0:
            score += (len(int1 & int2) / union) * 30

    lf1 = set(l.lower() for l in user1.get("lookingFor", []))
    lf2 = set(l.lower() for l in user2.get("lookingFor", []))
    role2 = user2.get("role", "").lower()
    role1 = user1.get("role", "").lower()
    skills2_lower = set(s.lower() for s in user2.get("skills", []))
    skills1_lower = set(s.lower() for s in user1.get("skills", []))
    if role2 in lf1 or bool(skills2_lower & lf1):
        score += 15
    if role1 in lf2 or bool(skills1_lower & lf2):
        score += 15

    return min(round(score), 100)


def _score_project(user, project):
    score = 0

    user_skills = set(s.lower() for s in user.get("skills", []))
    required = set(s.lower() for s in project.get("skills_required", []))
    if required:
        score += (len(user_skills & required) / len(required)) * 50
    elif user_skills:
        score += 20

    user_interests = set(i.lower() for i in user.get("interests", []))
    category = project.get("category", "").lower()
    if set(category.split()) & user_interests:
        score += 30
    elif any(w in project.get("description", "").lower() for w in user_interests):
        score += 15

    team_count = len(project.get("team_members", []))
    if team_count < 3:
        score += 20
    elif team_count < 5:
        score += 10

    return min(round(score), 100)


def _score_mentor(student, mentor):
    score = 0

    student_interests = set(i.lower() for i in student.get("interests", []))
    mentor_skills = set(s.lower() for s in mentor.get("skills", []))
    mentor_interests = set(i.lower() for i in mentor.get("interests", []))

    if student_interests and mentor_skills:
        overlap = len(student_interests & mentor_skills)
        score += min(overlap / max(len(student_interests), 1), 1) * 60

    if student_interests and mentor_interests:
        union = len(student_interests | mentor_interests)
        if union > 0:
            score += (len(student_interests & mentor_interests) / union) * 40

    return min(round(score), 100)


@matchmaking_bp.route("/feed", methods=["GET"])
@jwt_required()
def get_feed():
    user_id = get_jwt_identity()
    feed_type = request.args.get("type", "teammates")

    current_user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    match_interests = db["match_interests"]
    acted_ids = set(
        doc["target_id"]
        for doc in match_interests.find({"user_id": ObjectId(user_id)})
    )

    feed = []

    if feed_type == "teammates":
        for u in users_collection.find({"_id": {"$ne": ObjectId(user_id)}, "role": "student"}):
            uid = str(u["_id"])
            if uid in acted_ids:
                continue
            feed.append({
                "id": uid,
                "name": u.get("name", ""),
                "role": u.get("role", "student"),
                "bio": u.get("bio", ""),
                "skills": u.get("skills", []),
                "interests": u.get("interests", []),
                "score": _score_teammate(current_user, u),
            })

    elif feed_type == "projects":
        for p in projects_collection.find({"archived": {"$ne": True}}):
            pid = str(p["_id"])
            if pid in acted_ids:
                continue
            if str(p.get("owner_id", "")) == user_id:
                continue
            members = [str(m) for m in p.get("team_members", [])]
            if user_id in members:
                continue
            feed.append({
                "id": pid,
                "title": p.get("title", ""),
                "description": p.get("description", ""),
                "category": p.get("category", ""),
                "stage": p.get("stage", ""),
                "skills_required": p.get("skills_required", []),
                "team_size": len(p.get("team_members", [])),
                "score": _score_project(current_user, p),
            })

    elif feed_type == "mentors":
        for u in users_collection.find({"role": "mentor"}):
            uid = str(u["_id"])
            if uid in acted_ids:
                continue
            feed.append({
                "id": uid,
                "name": u.get("name", ""),
                "role": "mentor",
                "bio": u.get("bio", ""),
                "skills": u.get("skills", []),
                "interests": u.get("interests", []),
                "score": _score_mentor(current_user, u),
            })

    feed.sort(key=lambda x: x["score"], reverse=True)
    return jsonify({"feed": feed[:20]})


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

    match_interests = db["match_interests"]
    match_interests.update_one(
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
        reverse = match_interests.find_one({
            "user_id": ObjectId(target_id),
            "target_id": user_id,
            "action": "like",
        })
        is_mutual = reverse is not None

    return jsonify({"msg": "Recorded", "is_mutual": is_mutual})


@matchmaking_bp.route("/mutual", methods=["GET"])
@jwt_required()
def get_mutual_matches():
    user_id = get_jwt_identity()
    match_interests = db["match_interests"]

    my_likes = set(
        doc["target_id"]
        for doc in match_interests.find({
            "user_id": ObjectId(user_id),
            "action": "like",
            "target_type": {"$in": ["user", "mentor"]},
        })
    )

    mutual_ids = []
    for liked_id in my_likes:
        try:
            if match_interests.find_one({
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
