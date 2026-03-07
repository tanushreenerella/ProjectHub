
from flask_cors import CORS
from config import SECRET_KEY, JWT_SECRET_KEY
from extensions import jwt, socketio
from agents.orchestrator import startup_ai_orchestrator
from routes.auth_routes import auth_bp
from routes.ai_routes import ai_bp
from routes.idea_routes import idea_bp
from routes.project_routes import project_bp
from routes.conversation_routes import conversation_bp
from routes.task_routes import tasks_bp
from routes.user_routes import users_bp
from flask import Flask, jsonify, request
from routes.funding_routes import funding_bp
app = Flask(__name__)

# LOAD EVERYTHING FROM config.py
app.config.from_object("config")

CORS(app, supports_credentials=True)


jwt.init_app(app)
socketio.init_app(app)

# Import socket handlers to register them with socketio

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(ai_bp, url_prefix="/api/ai")
app.register_blueprint(idea_bp, url_prefix="/api/ideas")
app.register_blueprint(project_bp, url_prefix="/api/projects")
app.register_blueprint(conversation_bp, url_prefix="/api")
app.register_blueprint(users_bp, url_prefix="/api/users")
app.register_blueprint(tasks_bp, url_prefix="/api/tasks")

app.register_blueprint(funding_bp, url_prefix="/api/funding")

@app.route("/")
def home():
    return {"message": "ProjectHub backend is running 🚀"}
@app.route("/api/agents/startup", methods=["POST"])
def run_agents():
    data = request.json
    description = data.get("description")
    users = data.get("users")

    result = startup_ai_orchestrator(description, users)

    return jsonify(result)
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)