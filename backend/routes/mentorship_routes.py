from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime
from extensions import users_collection, db
from utils.notifications import create_notification

mentorship_bp = Blueprint("mentorship", __name__)

mentorship_collection = db["mentorship_requests"]
mentorship_feedback_collection = db["mentorship_feedback"]


def _serialize_user(user):
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "role": user.get("role", "student"),
        "skills": user.get("skills", []),
        "interests": user.get("interests", []),
        "bio": user.get("bio", "")
    }


def _serialize_request(req):
    return {
        "id": str(req["_id"]),
        "student_id": str(req["student_id"]),
        "mentor_id": str(req["mentor_id"]),
        "message": req.get("message", ""),
        "status": req.get("status", "pending"),
        "created_at": req["created_at"].isoformat() if req.get("created_at") else ""
    }


def _serialize_feedback(fb):
    return {
        "id": str(fb["_id"]),
        "mentor_id": str(fb["mentor_id"]),
        "student_id": str(fb["student_id"]),
        "project_id": str(fb["project_id"]) if fb.get("project_id") else "",
        "project_title": fb.get("project_title", ""),
        "feedback": fb.get("feedback", ""),
        "rating": fb.get("rating", None),
        "mentor_name": fb.get("mentor_name", ""),
        "created_at": fb["created_at"].isoformat() if fb.get("created_at") else ""
    }


def _is_mentor_role(role):
    return str(role or "").strip().lower() == "mentor"


# ── Student sends mentorship request to a mentor ──
@mentorship_bp.route("/request", methods=["POST"])
@jwt_required()
def send_mentorship_request():
    student_id = get_jwt_identity()
    data = request.get_json()
    mentor_id = data.get("mentor_id")
    message = data.get("message", "").strip()

    if not mentor_id:
        return jsonify({"error": "mentor_id is required"}), 400

    if student_id == mentor_id:
        return jsonify({"error": "Cannot request mentorship from yourself"}), 400

    mentor = users_collection.find_one({"_id": ObjectId(mentor_id)})
    if not mentor or not _is_mentor_role(mentor.get("role")):
        return jsonify({"error": "Mentor not found"}), 404

    student = users_collection.find_one({"_id": ObjectId(student_id)})

    # Check if request already exists
    existing = mentorship_collection.find_one({
        "student_id": ObjectId(student_id),
        "mentor_id": ObjectId(mentor_id),
        "status": {"$in": ["pending", "accepted"]}
    })
    if existing:
        return jsonify({"error": "Mentorship request already exists"}), 409

    req = {
        "student_id": ObjectId(student_id),
        "mentor_id": ObjectId(mentor_id),
        "message": message,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    result = mentorship_collection.insert_one(req)

    # Notify mentor
    student_name = student.get("name", "A student") if student else "A student"
    create_notification(
        mentor_id,
        "mentorship_request_received",
        "New mentorship request",
        f"{student_name} is requesting your mentorship",
        actor_id=student_id,
        actor_name=student_name
    )

    return jsonify({"msg": "Mentorship request sent", "request_id": str(result.inserted_id)}), 201


# ── Mentor responds to request ──
@mentorship_bp.route("/request/<request_id>/respond", methods=["POST"])
@jwt_required()
def respond_to_request(request_id):
    mentor_id = get_jwt_identity()
    data = request.get_json()
    action = data.get("action")  # "accept" or "reject"

    if action not in ["accept", "reject"]:
        return jsonify({"error": "action must be accept or reject"}), 400

    req = mentorship_collection.find_one({
        "_id": ObjectId(request_id),
        "mentor_id": ObjectId(mentor_id)
    })
    if not req:
        return jsonify({"error": "Request not found"}), 404

    mentorship_collection.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": action + "ed", "responded_at": datetime.utcnow()}}
    )

    mentor = users_collection.find_one({"_id": ObjectId(mentor_id)})
    mentor_name = mentor.get("name", "Your mentor") if mentor else "Your mentor"

    if action == "accept":
        # Add to each other's mentorship lists
        users_collection.update_one(
            {"_id": ObjectId(mentor_id)},
            {"$addToSet": {"mentees": str(req["student_id"])}}
        )
        users_collection.update_one(
            {"_id": req["student_id"]},
            {"$addToSet": {"mentors": str(mentor_id)}}
        )
        create_notification(
            str(req["student_id"]),
            "mentorship_accepted",
            "Mentorship request accepted",
            f"{mentor_name} accepted your mentorship request! You can now share projects for review.",
            actor_id=mentor_id,
            actor_name=mentor_name
        )
    else:
        create_notification(
            str(req["student_id"]),
            "mentorship_rejected",
            "Mentorship request declined",
            f"{mentor_name} was unable to take on your mentorship request.",
            actor_id=mentor_id,
            actor_name=mentor_name
        )

    return jsonify({"msg": f"Request {action}ed"})


# ── Mentor: get all their students + projects ──
@mentorship_bp.route("/my-students", methods=["GET"])
@jwt_required()
def get_my_students():
    mentor_id = get_jwt_identity()
    mentor = users_collection.find_one({"_id": ObjectId(mentor_id)})
    if not mentor or not _is_mentor_role(mentor.get("role")):
        return jsonify({"error": "Not a mentor"}), 403

    mentee_ids = mentor.get("mentees", [])
    students = []

    for sid in mentee_ids:
        student = users_collection.find_one({"_id": ObjectId(sid)})
        if not student:
            continue

        # Get their projects
        projects_collection = db["projects"]
        projects = list(projects_collection.find({
            "team_members": ObjectId(sid),
            "archived": {"$ne": True}
        }).limit(5))

        student_data = _serialize_user(student)
        student_data["projects"] = [
            {
                "id": str(p["_id"]),
                "title": p.get("title", ""),
                "description": p.get("description", ""),
                "category": p.get("category", ""),
                "stage": p.get("workspace_status", "active")
            }
            for p in projects
        ]

        # Get feedback given to this student
        feedback = list(mentorship_feedback_collection.find({
            "mentor_id": ObjectId(mentor_id),
            "student_id": ObjectId(sid)
        }).sort("created_at", -1).limit(3))
        student_data["feedback_given"] = [_serialize_feedback(f) for f in feedback]

        students.append(student_data)

    # Also get pending requests
    pending = list(mentorship_collection.find({
        "mentor_id": ObjectId(mentor_id),
        "status": "pending"
    }).sort("created_at", -1))

    pending_data = []
    for req in pending:
        student = users_collection.find_one({"_id": req["student_id"]})
        if student:
            item = _serialize_request(req)
            item["student_name"] = student.get("name", "")
            item["student_bio"] = student.get("bio", "")
            item["student_skills"] = student.get("skills", [])
            pending_data.append(item)

    return jsonify({"students": students, "pending_requests": pending_data})


# ── Student: get their mentors + feedback received ──
@mentorship_bp.route("/my-mentors", methods=["GET"])
@jwt_required()
def get_my_mentors():
    student_id = get_jwt_identity()
    student = users_collection.find_one({"_id": ObjectId(student_id)})
    if not student:
        return jsonify({"error": "User not found"}), 404

    mentor_ids = student.get("mentors", [])
    mentors = []

    for mid in mentor_ids:
        mentor = users_collection.find_one({"_id": ObjectId(mid)})
        if not mentor:
            continue
        mentor_data = _serialize_user(mentor)

        # Get feedback from this mentor
        feedback = list(mentorship_feedback_collection.find({
            "mentor_id": ObjectId(mid),
            "student_id": ObjectId(student_id)
        }).sort("created_at", -1))
        mentor_data["feedback"] = [_serialize_feedback(f) for f in feedback]
        mentors.append(mentor_data)

    # Pending requests sent by this student
    sent_requests = list(mentorship_collection.find({
        "student_id": ObjectId(student_id),
        "status": "pending"
    }))

    pending_data = []
    for req in sent_requests:
        mentor = users_collection.find_one({"_id": req["mentor_id"]})
        if mentor:
            item = _serialize_request(req)
            item["mentor_name"] = mentor.get("name", "")
            pending_data.append(item)

    # All feedback received
    all_feedback = list(mentorship_feedback_collection.find({
        "student_id": ObjectId(student_id)
    }).sort("created_at", -1))

    return jsonify({
        "mentors": mentors,
        "pending_requests": pending_data,
        "all_feedback": [_serialize_feedback(f) for f in all_feedback]
    })


# ── Mentor leaves feedback on a student's project ──
@mentorship_bp.route("/feedback", methods=["POST"])
@jwt_required()
def leave_feedback():
    mentor_id = get_jwt_identity()
    data = request.get_json()

    student_id = data.get("student_id")
    project_id = data.get("project_id", "")
    project_title = data.get("project_title", "General")
    feedback_text = data.get("feedback", "").strip()
    rating = data.get("rating")  # optional 1-5

    if not student_id or not feedback_text:
        return jsonify({"error": "student_id and feedback are required"}), 400

    mentor = users_collection.find_one({"_id": ObjectId(mentor_id)})
    if not mentor or not _is_mentor_role(mentor.get("role")):
        return jsonify({"error": "Only mentors can leave feedback"}), 403

    # Check they are actually mentoring this student
    student = users_collection.find_one({"_id": ObjectId(student_id)})
    if not student:
        return jsonify({"error": "Student not found"}), 404

    fb = {
        "mentor_id": ObjectId(mentor_id),
        "student_id": ObjectId(student_id),
        "project_id": ObjectId(project_id) if project_id else None,
        "project_title": project_title,
        "feedback": feedback_text,
        "rating": int(rating) if rating else None,
        "mentor_name": mentor.get("name", ""),
        "created_at": datetime.utcnow()
    }
    result = mentorship_feedback_collection.insert_one(fb)

    mentor_name = mentor.get("name", "Your mentor")
    create_notification(
        student_id,
        "mentorship_feedback_received",
        "New mentor feedback",
        f"{mentor_name} left feedback on {project_title}",
        actor_id=mentor_id,
        actor_name=mentor_name
    )

    return jsonify({"msg": "Feedback submitted", "feedback_id": str(result.inserted_id)}), 201


# ── Get all mentors (for students to browse) ──
@mentorship_bp.route("/mentors", methods=["GET"])
@jwt_required()
def get_all_mentors():
    mentors = list(users_collection.find({
        "role": {"$regex": r"^\s*mentor\s*$", "$options": "i"}
    }))
    result = []
    for m in mentors:
        data = _serialize_user(m)
        data["mentee_count"] = len(m.get("mentees", []))
        result.append(data)
    return jsonify({"mentors": result})


# ── Get all students (for mentors to browse) ──
@mentorship_bp.route("/students", methods=["GET"])
@jwt_required()
def get_all_students():
    students = list(users_collection.find({
        "role": {"$regex": r"^\s*student\s*$", "$options": "i"}
    }))
    result = []
    for s in students:
        data = _serialize_user(s)
        data["project_count"] = len(s.get("projects", []))
        result.append(data)
    return jsonify({"students": result})