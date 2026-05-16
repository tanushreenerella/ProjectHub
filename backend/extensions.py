from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
import pymongo
from config import MONGO_URI
from openai import OpenAI
import os
from groq import Groq
import dns.resolver

# Local routers often can't resolve MongoDB Atlas SRV/TXT records.
# Force Google DNS so the connection string always resolves correctly.
dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4']

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
user_embeddings_collection = db["user_embeddings"]
match_explanations_collection = db["match_explanations"]
match_interests_collection = db["match_interests"]
gemini_client = Groq(api_key=os.getenv("GROQ_API_KEY"))