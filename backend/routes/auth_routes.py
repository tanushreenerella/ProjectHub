import json
import os
import urllib.request
import urllib.error
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
import bcrypt

from config import GOOGLE_CLIENT_ID
from extensions import users_collection

auth_bp = Blueprint("auth", __name__)
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    email = data["email"]
    password = data["password"]

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "User exists"}), 400

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    normalized_role = str(data.get("role", "student")).strip().lower() or "student"

    user_doc = {
        "name": data.get("name", ""),
        "email": email,
        "password": hashed,
        "role": normalized_role,
        "skills": data.get("skills", []),
        "interests": data.get("interests", []),
        "lookingFor": data.get("lookingFor", []),
        "bio": data.get("bio", ""),
        "tags": data.get("skills", []) + data.get("interests", []),
        "created_at": datetime.utcnow()
    }

    user_id = users_collection.insert_one(user_doc).inserted_id

    token = create_access_token(identity=str(user_id))

    return jsonify({
        "access_token": token,
        "user_id": str(user_id),
        "role": normalized_role
    }), 201


def verify_google_token(id_token: str):
    if not GOOGLE_CLIENT_ID:
        raise ValueError("Google client ID is not configured on the backend.")

    tokeninfo_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
    try:
        with urllib.request.urlopen(tokeninfo_url, timeout=5) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError:
        raise ValueError("Invalid Google token")

    if payload.get("aud") != GOOGLE_CLIENT_ID:
        raise ValueError("Google token audience mismatch")

    if payload.get("email_verified") != "true":
        raise ValueError("Google email is not verified")

    return payload


@auth_bp.route("/google-login", methods=["POST"])
def google_login():
    data = request.get_json() or {}
    id_token = data.get("id_token")
    if not id_token:
        return jsonify({"error": "Missing Google ID token"}), 400

    try:
        payload = verify_google_token(id_token)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    email = payload.get("email")
    if not email:
        return jsonify({"error": "Google token did not include an email"}), 400

    user = users_collection.find_one({"email": email})
    if not user:
        hashed = bcrypt.hashpw("".encode(), bcrypt.gensalt())
        user_doc = {
            "name": payload.get("name", email.split("@")[0]),
            "email": email,
            "password": hashed,
            "role": "student",
            "skills": [],
            "interests": [],
            "lookingFor": [],
            "bio": "",
            "google_id": payload.get("sub"),
            "tags": [],
            "created_at": datetime.utcnow()
        }
        user_id = users_collection.insert_one(user_doc).inserted_id
        user = users_collection.find_one({"_id": user_id})

    token = create_access_token(identity=str(user["_id"]))
    return jsonify({
        "access_token": token,
        "user_id": str(user["_id"]),
        "role": str(user.get("role", "student")).strip().lower(),
        "name": user.get("name", email.split("@")[0]),
        "email": email
    })


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    user = users_collection.find_one({"email": data["email"]})

    if not user or not bcrypt.checkpw(
        data["password"].encode(), user["password"]
    ):
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_access_token(identity=str(user["_id"]))
    return jsonify({
        "access_token": token,
        "user_id": str(user["_id"]),
        "role": str(user.get("role", "student")).strip().lower(),
        "name": user.get("name", data["email"].split("@")[0]),
        "email": user.get("email", data["email"])
    })
