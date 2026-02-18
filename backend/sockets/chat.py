from flask_socketio import emit, join_room
from datetime import datetime
from bson import ObjectId
from extensions import socketio, messages_collection


@socketio.on('register')
def register(data):
    """Register a socket to a user-specific room so the server can push notifications/messages
    to a user's personal room even if they're not in the conversation room yet."""
    user_id = data.get('user_id')
    if not user_id:
        print('[socket] ❌ register called without user_id')
        return
    room = str(user_id)
    join_room(room)
    print(f"[socket] ✅ user {user_id} joined personal room {room}")

@socketio.on("load_conversation")
def load_conversation(data):
    """Load conversation history between two users"""
    user1_id = data.get("user1_id")
    user2_id = data.get("user2_id")
    
    # Create a sorted conversation ID (consistent regardless of order)
    conversation_id = "-".join(sorted([str(user1_id), str(user2_id)]))
    
    # Join the room
    join_room(conversation_id)
    print(f"[socket] load_conversation called for conv={conversation_id} user1={user1_id} user2={user2_id}")
    
    # Fetch messages from database
    query = {
        "$or": [
            {
                "sender_id": str(user1_id),
                "recipient_id": str(user2_id)
            },
            {
                "sender_id": str(user2_id),
                "recipient_id": str(user1_id)
            }
        ]
    }
    print(f"[socket] querying messages with: {query}")
    messages = list(
        messages_collection.find(query).sort("timestamp", 1).limit(500)
    )
    print(f"[socket] found {len(messages)} messages for conv={conversation_id}")
    
    # Format messages
    formatted_messages = []
    for msg in messages:
        formatted_messages.append({
            "id": str(msg.get("_id", "")),
            "sender_id": msg.get("sender_id", ""),
            "senderId": msg.get("sender_id", ""),
            "sender_name": msg.get("sender_name", "Unknown"),
            "senderName": msg.get("sender_name", "Unknown"),
            "text": msg.get("text", ""),
            "timestamp": msg.get("timestamp", datetime.utcnow()).isoformat()
        })
    
    emit("conversation_history", {
        "conversation_id": conversation_id,
        "conversationId": conversation_id,
        "messages": formatted_messages
    })

@socketio.on("send_message")
def send_message(data):
    """Send a message between two users"""
    print(f"\n[socket] === SEND_MESSAGE CALLED ===")
    print(f"[socket] data received: {data}")
    
    user1_id = data.get("user1_id")
    user2_id = data.get("user2_id")
    text = data.get("text", "")
    sender_name = data.get("sender_name", "Unknown")
    print(f"[socket] parsed: user1={user1_id}, user2={user2_id}, text={text[:50]}, sender={sender_name}")
    
    if not user1_id or not user2_id or not text:
        print(f"[socket] MISSING DATA - aborting send_message")
        return emit("error", {"msg": "missing user1_id, user2_id, or text"})
    
    # Create a sorted conversation ID
    conversation_id = "-".join(sorted([str(user1_id), str(user2_id)]))
    print(f"[socket] conversation_id: {conversation_id}")
    
    msg = {
        "sender_id": str(user1_id),
        "sender_name": sender_name,
        "recipient_id": str(user2_id),
        "text": text,
        "timestamp": datetime.utcnow()
    }

    # Insert into database
    print(f"[socket] inserting into messages_collection: {msg}")
    result = messages_collection.insert_one(msg)
    print(f"[socket] ✅ inserted with _id: {result.inserted_id}")

    payload = {
        "id": str(result.inserted_id),
        "conversation_id": conversation_id,
        "conversationId": conversation_id,
        "sender_id": str(user1_id),
        "senderId": str(user1_id),
        "sender_name": sender_name,
        "senderName": sender_name,
        "text": text,
        "timestamp": msg["timestamp"].isoformat()
    }
    print(f"[socket] payload built: {payload}")

    # Emit to conversation room (clients who have opened the convo)
    print(f"[socket] emitting receive_message to room={conversation_id}")
    emit("receive_message", payload, room=conversation_id)
    print(f"[socket] ✅ emitted to conversation room")

    # Also emit to recipient's personal room so they get notified in real-time even
    # when they haven't joined the conversation room yet
    try:
        print(f"[socket] emitting receive_message to personal room={str(user2_id)}")
        emit("receive_message", payload, room=str(user2_id))
        print(f"[socket] ✅ emitted to personal room")
    except Exception as e:
        print(f"[socket] ❌ failed to emit to personal room {user2_id}:", e)

    print(f"[socket] ✅✅✅ message saved {result.inserted_id} conv={conversation_id} from={user1_id} to={user2_id}")
    print(f"[socket] === SEND_MESSAGE COMPLETE ===\n")

