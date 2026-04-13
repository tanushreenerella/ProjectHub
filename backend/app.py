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
from routes.notification_routes import notifications_bp
from apscheduler.schedulers.background import BackgroundScheduler
from jobs.reminders import send_inactivity_reminders
from routes.mentorship_routes import mentorship_bp
import atexit
import os
app = Flask(__name__)

# LOAD EVERYTHING FROM config.py
app.config.from_object("config")

CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:5173",
        "https://tanushreenerella.github.io",
        "https://shambhavi-singh05.github.io"
    ]
)


jwt.init_app(app)
socketio.init_app(app, cors_allowed_origins="*")
# Import socket handlers to register them with socketio
import sockets.chat  # noqa: F401

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(ai_bp, url_prefix="/api/ai")
app.register_blueprint(idea_bp, url_prefix="/api/ideas")
app.register_blueprint(project_bp, url_prefix="/api/projects")
app.register_blueprint(conversation_bp, url_prefix="/api")
app.register_blueprint(users_bp, url_prefix="/api/users")
app.register_blueprint(tasks_bp, url_prefix="/api/tasks")
app.register_blueprint(funding_bp, url_prefix="/api/funding")
app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
app.register_blueprint(mentorship_bp, url_prefix="/api/mentorship")
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
def run_inactivity_reminders_job():
    try:
        result = send_inactivity_reminders()
        print(f"[scheduler] inactivity reminders result: {result}")
    except Exception as e:
        print(f"[scheduler] inactivity reminders failed: {e}")
scheduler = BackgroundScheduler()

scheduler.add_job(
    func=run_inactivity_reminders_job,
    trigger="interval",
    minutes=1,
    id="inactivity_reminders_job",
    replace_existing=True
)

scheduler.start()

atexit.register(lambda: scheduler.shutdown())

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)
