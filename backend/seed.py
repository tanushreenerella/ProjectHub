# Seed script: populates MongoDB with sample users, projects, and connections.
# Run once from the backend folder:
#   anaconda3\python.exe seed.py

import os
import sys
import dns.resolver
from datetime import datetime, timedelta
from dotenv import load_dotenv
import pymongo
import bcrypt
from bson import ObjectId

load_dotenv()

# Force Google DNS (same fix as extensions.py)
dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ["8.8.8.8", "8.8.4.4"]

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    print("ERROR: MONGO_URI not set in .env")
    sys.exit(1)

client = pymongo.MongoClient(MONGO_URI)
db = client.get_default_database()

users_col      = db["users"]
projects_col   = db["projects"]
activity_col   = db["project_activity"]
notif_col      = db["notifications"]

def h(pw: str) -> bytes:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt())

now = datetime.utcnow()

# ── 1. Users ──────────────────────────────────────────────────────────────────

USERS = [
    {
        "name": "Priya Sharma",
        "email": "priya@demo.com",
        "password": h("demo123"),
        "role": "student",
        "skills": ["React", "TypeScript", "UI/UX Design", "Figma"],
        "interests": ["EdTech", "AI", "Sustainability"],
        "lookingFor": ["backend developer", "ML engineer"],
        "bio": "Frontend engineer passionate about building inclusive ed-tech products.",
        "tags": ["React", "TypeScript", "UI/UX Design", "Figma", "EdTech", "AI", "Sustainability"],
        "connections": [],
        "created_at": now - timedelta(days=10),
    },
    {
        "name": "Rohan Mehta",
        "email": "rohan@demo.com",
        "password": h("demo123"),
        "role": "student",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "interests": ["FinTech", "Open Source", "DevOps"],
        "lookingFor": ["frontend developer", "designer"],
        "bio": "Backend engineer who loves shipping reliable APIs.",
        "tags": ["Python", "FastAPI", "PostgreSQL", "Docker", "FinTech", "Open Source"],
        "connections": [],
        "created_at": now - timedelta(days=8),
    },
    {
        "name": "Aisha Khan",
        "email": "aisha@demo.com",
        "password": h("demo123"),
        "role": "student",
        "skills": ["Machine Learning", "PyTorch", "Data Analysis", "Python"],
        "interests": ["HealthTech", "AI", "Research"],
        "lookingFor": ["product manager", "frontend developer"],
        "bio": "ML researcher focused on healthcare applications.",
        "tags": ["Machine Learning", "PyTorch", "Data Analysis", "HealthTech", "AI"],
        "connections": [],
        "created_at": now - timedelta(days=6),
    },
    {
        "name": "Dev Patel",
        "email": "dev@demo.com",
        "password": h("demo123"),
        "role": "student",
        "skills": ["iOS", "Swift", "React Native", "Firebase"],
        "interests": ["Social Impact", "EdTech", "Mobile"],
        "lookingFor": ["backend developer", "ML engineer"],
        "bio": "Mobile developer building apps that matter.",
        "tags": ["iOS", "Swift", "React Native", "Firebase", "EdTech", "Mobile"],
        "connections": [],
        "created_at": now - timedelta(days=5),
    },
    {
        "name": "Tanvi Joshi",
        "email": "tanvi@demo.com",
        "password": h("demo123"),
        "role": "student",
        "skills": ["Product Management", "Figma", "Market Research", "Agile"],
        "interests": ["SaaS", "Sustainability", "FinTech"],
        "lookingFor": ["developer", "designer"],
        "bio": "PM who bridges design and engineering.",
        "tags": ["Product Management", "Figma", "Agile", "SaaS", "Sustainability"],
        "connections": [],
        "created_at": now - timedelta(days=3),
    },
    {
        "name": "Dr. Neha Gupta",
        "email": "neha@demo.com",
        "password": h("demo123"),
        "role": "mentor",
        "skills": ["Startup Strategy", "Fundraising", "Product-Market Fit", "Growth Hacking"],
        "interests": ["EdTech", "AI", "Social Impact"],
        "lookingFor": [],
        "bio": "Serial entrepreneur and angel investor. Helped 20+ startups raise seed rounds.",
        "tags": ["Startup Strategy", "Fundraising", "EdTech", "AI"],
        "mentees": [],
        "created_at": now - timedelta(days=30),
    },
    {
        "name": "Arjun Nair",
        "email": "arjun@demo.com",
        "password": h("demo123"),
        "role": "mentor",
        "skills": ["Full Stack", "System Design", "Cloud Architecture", "Python", "React"],
        "interests": ["FinTech", "DevOps", "Open Source"],
        "lookingFor": [],
        "bio": "Principal engineer at a fintech unicorn. Mentor for technical founders.",
        "tags": ["Full Stack", "System Design", "Cloud Architecture", "FinTech"],
        "mentees": [],
        "created_at": now - timedelta(days=25),
    },
]

print("Inserting users...")
inserted_ids = []
for u in USERS:
    existing = users_col.find_one({"email": u["email"]})
    if existing:
        print(f"  skip (exists): {u['email']}")
        inserted_ids.append(existing["_id"])
    else:
        res = users_col.insert_one(u)
        inserted_ids.append(res.inserted_id)
        print(f"  created: {u['email']}")

priya, rohan, aisha, dev, tanvi, neha, arjun = inserted_ids

# ── 2. Connect some students ──────────────────────────────────────────────────

def connect(a, b):
    users_col.update_one({"_id": a}, {"$addToSet": {"connections": str(b)}})
    users_col.update_one({"_id": b}, {"$addToSet": {"connections": str(a)}})

connect(priya, rohan)
connect(priya, aisha)
connect(rohan, dev)
connect(aisha, tanvi)
print("Connections added.")

# ── 3. Projects ───────────────────────────────────────────────────────────────

PROJECTS = [
    {
        "title": "EduMatch",
        "description": "AI-powered platform that matches students with study groups and tutors based on learning styles and subject needs.",
        "category": "EdTech",
        "stage": "mvp",
        "workspace_status": "active",
        "workspace_priority": "high",
        "skills_required": ["React", "Python", "Machine Learning"],
        "owner_id": priya,
        "team_members": [priya, rohan],
        "funding_goal": 5000,
        "funds_raised": 1200,
        "notes": "MVP live, collecting beta users.",
        "start_date": now - timedelta(days=20),
        "end_date": now + timedelta(days=60),
        "created_at": now - timedelta(days=20),
    },
    {
        "title": "GreenLedger",
        "description": "Blockchain-based carbon credit tracking tool for college campuses to measure and offset their environmental impact.",
        "category": "Sustainability",
        "stage": "ideation",
        "workspace_status": "active",
        "workspace_priority": "medium",
        "skills_required": ["Solidity", "React", "Node.js", "Data Analysis"],
        "owner_id": rohan,
        "team_members": [rohan, tanvi],
        "funding_goal": 8000,
        "funds_raised": 0,
        "notes": "Looking for a blockchain dev to join.",
        "start_date": now - timedelta(days=5),
        "end_date": now + timedelta(days=90),
        "created_at": now - timedelta(days=5),
    },
    {
        "title": "MedScan AI",
        "description": "Mobile app using computer vision to help rural clinics pre-screen common skin conditions before specialist consultation.",
        "category": "HealthTech",
        "stage": "prototype",
        "workspace_status": "active",
        "workspace_priority": "high",
        "skills_required": ["PyTorch", "React Native", "FastAPI"],
        "owner_id": aisha,
        "team_members": [aisha, dev],
        "funding_goal": 12000,
        "funds_raised": 3500,
        "notes": "Prototype tested in 2 clinics. Expanding dataset.",
        "start_date": now - timedelta(days=15),
        "end_date": now + timedelta(days=45),
        "created_at": now - timedelta(days=15),
    },
    {
        "title": "CampusPay",
        "description": "Unified payment wallet for college canteens, libraries, and events — no cash, no card needed.",
        "category": "FinTech",
        "stage": "mvp",
        "workspace_status": "active",
        "workspace_priority": "medium",
        "skills_required": ["React Native", "Node.js", "PostgreSQL"],
        "owner_id": dev,
        "team_members": [dev],
        "funding_goal": 6000,
        "funds_raised": 800,
        "notes": "Looking for a backend dev. MVP for Android done.",
        "start_date": now - timedelta(days=12),
        "end_date": now + timedelta(days=50),
        "created_at": now - timedelta(days=12),
    },
    {
        "title": "SkillBridge",
        "description": "Peer-to-peer micro-mentorship marketplace where seniors teach skills to juniors for campus credits.",
        "category": "EdTech",
        "stage": "ideation",
        "workspace_status": "active",
        "workspace_priority": "low",
        "skills_required": ["React", "Python", "Product Management"],
        "owner_id": tanvi,
        "team_members": [tanvi, priya],
        "funding_goal": 3000,
        "funds_raised": 500,
        "notes": "Idea validated with 50 survey responses.",
        "start_date": now - timedelta(days=3),
        "end_date": now + timedelta(days=120),
        "created_at": now - timedelta(days=3),
    },
]

print("Inserting projects...")
project_ids = []
for p in PROJECTS:
    existing = projects_col.find_one({"title": p["title"], "owner_id": p["owner_id"]})
    if existing:
        print(f"  skip (exists): {p['title']}")
        project_ids.append(existing["_id"])
    else:
        res = projects_col.insert_one(p)
        project_ids.append(res.inserted_id)
        print(f"  created: {p['title']}")

        # Log activity
        activity_col.insert_one({
            "project_id": res.inserted_id,
            "event_type": "project_created",
            "actor_id": p["owner_id"],
            "actor_name": next(u["name"] for u in USERS if u.get("email") and users_col.find_one({"_id": p["owner_id"], "email": u["email"]})) if False else "Team",
            "message": f"Project '{p['title']}' created",
            "metadata": {},
            "created_at": p["created_at"],
        })

# ── 4. Sample notifications ───────────────────────────────────────────────────

print("Inserting notifications...")
sample_notifs = [
    {
        "user_id": priya,
        "type": "connection_request_accepted",
        "title": "Connection accepted",
        "message": "Rohan Mehta accepted your connection request",
        "read": False,
        "project_id": None,
        "actor_id": rohan,
        "actor_name": "Rohan Mehta",
        "created_at": now - timedelta(hours=2),
    },
    {
        "user_id": rohan,
        "type": "project_invite_received",
        "title": "Project invitation",
        "message": "You were invited to join EduMatch as developer",
        "read": False,
        "project_id": project_ids[0],
        "actor_id": priya,
        "actor_name": "Priya Sharma",
        "created_at": now - timedelta(hours=5),
    },
    {
        "user_id": aisha,
        "type": "mentorship_request_received",
        "title": "Mentorship request sent",
        "message": "Your mentorship request to Dr. Neha Gupta was sent",
        "read": True,
        "project_id": None,
        "actor_id": neha,
        "actor_name": "Dr. Neha Gupta",
        "created_at": now - timedelta(days=1),
    },
]

for n in sample_notifs:
    notif_col.insert_one(n)

print("Notifications added.")

print("\n✅ Seed complete! Demo accounts (password: demo123):")
print("  Students : priya@demo.com | rohan@demo.com | aisha@demo.com | dev@demo.com | tanvi@demo.com")
print("  Mentors  : neha@demo.com  | arjun@demo.com")
