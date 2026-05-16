import os
import numpy as np
from google import genai
from extensions import user_embeddings_collection
from datetime import datetime

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set in environment")
        _client = genai.Client(api_key=api_key)
    return _client


def build_profile_text(user: dict) -> str:
    parts = []
    name = user.get("name", "")
    role = user.get("role", "student")
    if name:
        parts.append(f"{name} is a {role}.")
    skills = user.get("skills", [])
    if skills:
        parts.append(f"Skills: {', '.join(skills)}.")
    interests = user.get("interests", [])
    if interests:
        parts.append(f"Interests: {', '.join(interests)}.")
    bio = user.get("bio", "")
    if bio:
        parts.append(f"Bio: {bio[:300]}.")
    looking = user.get("lookingFor", [])
    if looking:
        parts.append(f"Looking for: {', '.join(looking)}.")
    return " ".join(parts)


def generate_embedding(text: str) -> list:
    client = _get_client()
    result = client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=text,
    )
    return result.embeddings[0].values


def upsert_user_embedding(user: dict) -> list:
    user_id = str(user["_id"])
    text = build_profile_text(user)
    embedding = generate_embedding(text)
    user_embeddings_collection.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "embedding": list(embedding),
            "text_used": text,
            "updated_at": datetime.utcnow(),
        }},
        upsert=True,
    )
    return list(embedding)


def get_stored_embedding(user_id: str) -> list | None:
    doc = user_embeddings_collection.find_one({"user_id": user_id})
    return doc["embedding"] if doc else None


def cosine_similarity(a: list, b: list) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))
