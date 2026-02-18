from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import conversations_collection, messages_collection

conversation_bp = Blueprint("conversations", __name__)

@conversation_bp.route("/conversations", methods=["GET"])
@jwt_required()
def get_conversations():
    user_id = get_jwt_identity()
    convos = conversations_collection.find({"participants": user_id})

    result = []
    for c in convos:
        last = messages_collection.find_one(
            {"conversationId": c["_id"]},
            sort=[("timestamp", -1)]
        )
        result.append({
            "conversation_id": str(c["_id"]),
            "last_message": last["text"] if last else ""
        })

    return jsonify({"conversations": result})


@conversation_bp.route('/debug/messages', methods=['GET'])
@jwt_required()
def debug_messages():
    """Temporary debug endpoint: return stored messages between two users.
    Query params: user1, user2 (user ids)
    """
    from flask import request
    user1 = request.args.get('user1')
    user2 = request.args.get('user2')
    if not user1 or not user2:
        return jsonify({'error': 'provide user1 and user2 query params'}), 400

    query = {
        "$or": [
            {"sender_id": str(user1), "recipient_id": str(user2)},
            {"sender_id": str(user2), "recipient_id": str(user1)}
        ]
    }
    msgs = list(messages_collection.find(query).sort('timestamp', 1))
    out = []
    for m in msgs:
        out.append({
            'id': str(m.get('_id')),
            'sender_id': m.get('sender_id'),
            'sender_name': m.get('sender_name'),
            'recipient_id': m.get('recipient_id'),
            'text': m.get('text'),
            'timestamp': m.get('timestamp').isoformat() if m.get('timestamp') else None
        })
    return jsonify({'count': len(out), 'messages': out})
