
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from extensions import users_collection, db
from datetime import datetime

users_bp = Blueprint("users", __name__)
from flask_jwt_extended import get_jwt_identity

@jwt_required()
def get_me():
    print("JWT OK:", get_jwt_identity())
@users_bp.route("/match", methods=["GET"])
@jwt_required()
def match_users():
    user_id = get_jwt_identity()

    current_user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    my_tags = set(current_user.get("tags", []))

    matches = []

    for u in users_collection.find({"_id": {"$ne": ObjectId(user_id)}}):
        score = len(my_tags.intersection(set(u.get("tags", []))))
        matches.append({
            "id": str(u["_id"]),
            "user_id": str(u["_id"]),
            "name": u.get("name", "Unknown User"),
            "email": u.get("email", ""),
            "role": u.get("role", "student"),
            "skills": u.get("skills", []),
            "interests": u.get("interests", []),
            "bio": u.get("bio", ""),
            "projects": u.get("projects", []),
            "connections": u.get("connections", []),
            "score": score
        })

    matches.sort(key=lambda x: x["score"], reverse=True)

    return jsonify({"matches": matches[:10]})

@users_bp.route("/update-bio", methods=["POST"])
@jwt_required()
def update_bio():
    user_id = get_jwt_identity()
    data = request.get_json()

    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"bio": data["bio"]}}
    )

    return jsonify({"msg": "Updated"})

@users_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()

    user = users_collection.find_one({"_id": ObjectId(user_id)})

    return jsonify({
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "bio": user.get("bio", ""),
        "skills": user.get("skills", []),
        "interests": user.get("interests", []),
        "role": user.get("role", "")
    })
@users_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_me():
    user_id = get_jwt_identity()
    data = request.get_json()

    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "name": data.get("name"),
            "bio": data.get("bio"),
            "skills": data.get("skills", []),
            "interests": data.get("interests", []),
            "tags": data.get("skills", []) + data.get("interests", [])
        }}
    )

    return jsonify({"msg": "Profile updated"})

# ===== CONNECTION REQUESTS ENDPOINTS =====

@users_bp.route("/send-connection", methods=["POST"])
@jwt_required()
def send_connection():
    from_user_id = get_jwt_identity()
    data = request.get_json()
    
    to_user_id = data.get("to_user_id")
    message = data.get("message", "")
    
    print(f"\n=== SEND CONNECTION DEBUG ===")
    print(f"Current User ID: {from_user_id}")
    print(f"To User ID: {to_user_id}")
    print(f"Message: {message}")
    print(f"Data received: {data}")
    
    # Validation
    if not to_user_id:
        print("ERROR: to_user_id is required")
        return jsonify({"error": "to_user_id is required"}), 400
    
    if from_user_id == to_user_id:
        print("ERROR: Cannot send connection to yourself")
        return jsonify({"error": "Cannot send connection to yourself"}), 400
    
    # Check if recipient exists
    try:
        recipient = users_collection.find_one({"_id": ObjectId(to_user_id)})
        print(f"Recipient found: {recipient is not None}")
    except Exception as e:
        print(f"ERROR: Invalid user ID format - {e}")
        return jsonify({"error": "Invalid user ID format"}), 400
        
    if not recipient:
        print("ERROR: User not found")
        return jsonify({"error": "User not found"}), 404
    
    # Check if connection request already exists
    connections_collection = db["connection_requests"]
    existing = connections_collection.find_one({
        "from_user_id": ObjectId(from_user_id),
        "to_user_id": ObjectId(to_user_id),
        "status": {"$in": ["pending", "accepted"]}
    })
    
    if existing:
        print("ERROR: Connection request already exists")
        return jsonify({"error": "Connection request already exists"}), 409
    
    # Create connection request
    request_obj = {
        "from_user_id": ObjectId(from_user_id),
        "to_user_id": ObjectId(to_user_id),
        "message": message,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = connections_collection.insert_one(request_obj)
    print(f"SUCCESS: Connection request saved with ID: {result.inserted_id}")
    print("=== END DEBUG ===\n")
    
    return jsonify({
        "msg": "Connection request sent",
        "request_id": str(result.inserted_id)
    }), 201

@users_bp.route("/connection-requests", methods=["GET"])
@jwt_required()
def get_connection_requests():
    user_id = get_jwt_identity()
    connections_collection = db["connection_requests"]
    
    print(f"DEBUG: get_connection_requests called for user: {user_id}")
    
    # Get BOTH pending requests sent TO this user AND sent BY this user
    requests = list(connections_collection.find({
        "$or": [
            {
                "to_user_id": ObjectId(user_id),
                "status": "pending"
            },
            {
                "from_user_id": ObjectId(user_id),
                "status": "pending"
            }
        ]
    }).sort("created_at", -1))
    
    print(f"DEBUG: Found {len(requests)} connection requests")
    
    # Enrich with sender/recipient information
    enriched_requests = []
    for req in requests:
        # Determine if request is received or sent
        if req["to_user_id"] == ObjectId(user_id):
            # Request received from someone
            other_user = users_collection.find_one({"_id": req["from_user_id"]})
            other_user_id = str(req["from_user_id"])
        else:
            # Request sent by this user
            other_user = users_collection.find_one({"_id": req["to_user_id"]})
            other_user_id = str(req["to_user_id"])
        
        if other_user:
            enriched_requests.append({
                "id": str(req["_id"]),
                "from_user_id": str(req["from_user_id"]),
                "to_user_id": str(req["to_user_id"]),
                "other_user_id": other_user_id,  # The other person in this request
                "from_user_name": other_user.get("name", "Unknown"),
                "from_user_email": other_user.get("email", ""),
                "from_user_role": other_user.get("role", "student"),
                "from_user_skills": other_user.get("skills", []),
                "message": req.get("message", ""),
                "is_received": req["to_user_id"] == ObjectId(user_id),  # True if received, False if sent
                "created_at": req["created_at"].isoformat()
            })
    
    return jsonify({"requests": enriched_requests})

@users_bp.route("/connection-requests/<request_id>/accept", methods=["POST"])
@jwt_required()
def accept_connection(request_id):
    user_id = get_jwt_identity()
    connections_collection = db["connection_requests"]
    
    # Find the request
    conn_request = connections_collection.find_one({
        "_id": ObjectId(request_id),
        "to_user_id": ObjectId(user_id)
    })
    
    if not conn_request:
        return jsonify({"error": "Connection request not found"}), 404
    
    # Update request status
    connections_collection.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "accepted", "updated_at": datetime.utcnow()}}
    )
    
    # Add to connections list for both users
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"connections": str(conn_request["from_user_id"])}}
    )
    
    users_collection.update_one(
        {"_id": conn_request["from_user_id"]},
        {"$addToSet": {"connections": str(user_id)}}
    )
    
    return jsonify({"msg": "Connection accepted"})

@users_bp.route("/connection-requests/<request_id>/reject", methods=["POST"])
@jwt_required()
def reject_connection(request_id):
    user_id = get_jwt_identity()
    connections_collection = db["connection_requests"]
    
    # Find and update request
    conn_request = connections_collection.find_one({
        "_id": ObjectId(request_id),
        "to_user_id": ObjectId(user_id)
    })
    
    if not conn_request:
        return jsonify({"error": "Connection request not found"}), 404
    
    connections_collection.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "rejected", "updated_at": datetime.utcnow()}}
    )
    
    return jsonify({"msg": "Connection rejected"})

@users_bp.route("/connections", methods=["GET"])
@jwt_required()
def get_connections():
    user_id = get_jwt_identity()
    print(f"DEBUG: get_connections called for user: {user_id}")
    
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    connections = user.get("connections", [])
    print(f"DEBUG: User has {len(connections)} connections")
    
    # Get details of connected users
    connected_users = []
    for conn_id in connections:
        try:
            conn_user = users_collection.find_one({"_id": ObjectId(conn_id)})
            if conn_user:
                connected_users.append({
                    "id": str(conn_user["_id"]),
                    "name": conn_user.get("name", "Unknown"),
                    "email": conn_user.get("email", ""),
                    "role": conn_user.get("role", "student"),
                    "skills": conn_user.get("skills", []),
                    "interests": conn_user.get("interests", []),
                    "bio": conn_user.get("bio", "")
                })
        except:
            pass
    
    return jsonify({"connections": connected_users})
