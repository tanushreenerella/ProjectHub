from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
import pymongo
from config import MONGO_URI
from openai import OpenAI
import os
from groq import Groq
jwt = JWTManager()
socketio = SocketIO(cors_allowed_origins="*", async_mode="threading")

mongo_client = pymongo.MongoClient(MONGO_URI)
db = mongo_client["projecthub"]

users_collection = db.get_collection("users")
projects_collection = db.get_collection("projects")
ideas_collection = db.get_collection("ideas")
messages_collection = db.get_collection("messages")
conversations_collection = db.get_collection("conversations")
tasks_collection = db.get_collection("tasks")
project_invites_collection = db.get_collection("project_invites")
project_activity_collection = db.get_collection("project_activity")
notifications_collection = db["notifications"]
knowledge_chunks_collection = db.get_collection("knowledge_chunks")
gemini_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
print("API KEY:", os.getenv("GROQ_API_KEY"))