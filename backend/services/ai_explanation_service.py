import os
from google import genai
from extensions import match_explanations_collection
from datetime import datetime, timedelta

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")
        _client = genai.Client(api_key=api_key)
    return _client


def _sorted_key(id_a: str, id_b: str):
    return tuple(sorted([id_a, id_b]))


def _profile_summary(user: dict) -> str:
    role = user.get("role", "student")
    name = user.get("name", "This person")
    skills = ", ".join(user.get("skills", [])[:6]) or "not listed"
    interests = ", ".join(user.get("interests", [])[:5]) or "not listed"
    bio = (user.get("bio", "") or "")[:200]
    looking = ", ".join(user.get("lookingFor", [])[:3])
    summary = f"{name} ({role}) — Skills: {skills}. Interests: {interests}."
    if bio:
        summary += f" {bio}"
    if looking:
        summary += f" Looking for: {looking}."
    return summary


def get_match_explanation(user_a: dict, user_b: dict) -> str:
    id_a = str(user_a.get("_id", ""))
    id_b = str(user_b.get("_id", ""))
    key_a, key_b = _sorted_key(id_a, id_b)

    cached = match_explanations_collection.find_one({
        "user_a_id": key_a,
        "user_b_id": key_b,
        "created_at": {"$gt": datetime.utcnow() - timedelta(days=7)},
    })
    if cached:
        return cached["explanation"]

    prompt = f"""You are an AI assistant for a student startup collaboration platform.

Collaborator A: {_profile_summary(user_a)}
Collaborator B: {_profile_summary(user_b)}

Write exactly 2 sentences explaining why these two people would be great startup collaborators. Be specific about their complementary skills or shared goals. Keep it energetic and actionable."""

    try:
        client = _get_client()
        response = client.models.generate_content(
            model="models/gemini-2.5-flash-lite",
            contents=prompt,
        )
        explanation = response.text.strip()
    except Exception as e:
        print(f"[ai_explanation] Gemini call failed: {e}")
        explanation = "Strong skill and interest alignment — great potential collaborators."

    match_explanations_collection.update_one(
        {"user_a_id": key_a, "user_b_id": key_b},
        {"$set": {
            "user_a_id": key_a,
            "user_b_id": key_b,
            "explanation": explanation,
            "created_at": datetime.utcnow(),
        }},
        upsert=True,
    )
    return explanation
