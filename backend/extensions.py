from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
import pymongo
from config import MONGO_URI
from config import MONGO_URI
from openai import OpenAI
import os
jwt = JWTManager()
socketio = SocketIO(cors_allowed_origins="*", async_mode="threading")

mongo_client = pymongo.MongoClient(MONGO_URI)
db = mongo_client.get_default_database()

users_collection = db.get_collection("users")
projects_collection = db.get_collection("projects")
ideas_collection = db.get_collection("ideas")
messages_collection = db.get_collection("messages")
conversations_collection = db.get_collection("conversations")
tasks_collection = db.get_collection("tasks")
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
