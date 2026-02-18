
from flask_cors import CORS
from config import SECRET_KEY, JWT_SECRET_KEY
from extensions import jwt, socketio
from agents.orchestrator import startup_ai_orchestrator
from routes.auth_routes import auth_bp
from routes.ai_routes import ai_bp
from routes.idea_routes import idea_bp
from routes.project_routes import project_bp
from routes.conversation_routes import conversation_bp
from routes.user_routes import users_bp
from flask import Flask, jsonify, request


app = Flask(__name__)

# LOAD EVERYTHING FROM config.py
app.config.from_object("config")

CORS(app, supports_credentials=True)


jwt.init_app(app)
socketio.init_app(app)

# Import socket handlers to register them with socketio
import sockets.chat

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(ai_bp, url_prefix="/api/ai")
app.register_blueprint(idea_bp, url_prefix="/api/ideas")
app.register_blueprint(project_bp, url_prefix="/api/projects")
app.register_blueprint(conversation_bp, url_prefix="/api")
app.register_blueprint(users_bp, url_prefix="/api/users")
from routes.funding_routes import funding_bp
app.register_blueprint(funding_bp, url_prefix="/api/funding")
@app.route("/api/agents/startup", methods=["POST"])
def run_agents():
    data = request.json
    description = data.get("description")
    users = data.get("users")

    result = startup_ai_orchestrator(description, users)

    return jsonify(result)
if __name__ == "__main__":
    socketio.run(app, debug=False, use_reloader=False)
