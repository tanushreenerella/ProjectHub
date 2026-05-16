from bson import ObjectId
from extensions import users_collection, projects_collection, match_interests_collection
from services.embedding_service import (
    get_stored_embedding,
    upsert_user_embedding,
    generate_embedding,
    cosine_similarity,
)


def _get_acted_ids(user_id: str) -> set:
    return set(
        doc["target_id"]
        for doc in match_interests_collection.find({"user_id": ObjectId(user_id)})
    )


def _ensure_embedding(user: dict) -> list | None:
    user_id = str(user["_id"])
    embedding = get_stored_embedding(user_id)
    if embedding is None:
        try:
            embedding = upsert_user_embedding(user)
        except Exception as e:
            print(f"[matching] failed to embed user {user_id}: {e}")
            return None
    return embedding


def get_ranked_feed(current_user: dict, feed_type: str, limit: int = 20) -> list:
    user_id = str(current_user["_id"])

    current_embedding = _ensure_embedding(current_user)
    if current_embedding is None:
        return []

    acted_ids = _get_acted_ids(user_id)
    results = []

    if feed_type in ("teammates", "mentors"):
        role_filter = "mentor" if feed_type == "mentors" else "student"
        query = {
            "_id": {"$ne": ObjectId(user_id)},
            "role": role_filter,
        }
        for candidate in users_collection.find(query):
            cid = str(candidate["_id"])
            if cid in acted_ids:
                continue
            candidate_embedding = _ensure_embedding(candidate)
            if candidate_embedding is None:
                continue
            sim = cosine_similarity(current_embedding, candidate_embedding)
            results.append({
                "id": cid,
                "name": candidate.get("name", ""),
                "role": candidate.get("role", "student"),
                "bio": candidate.get("bio", ""),
                "skills": candidate.get("skills", []),
                "interests": candidate.get("interests", []),
                "score": round(sim * 100),
                "ai_explanation": None,
            })

    elif feed_type == "projects":
        for project in projects_collection.find({"archived": {"$ne": True}}):
            pid = str(project["_id"])
            if pid in acted_ids:
                continue
            if str(project.get("owner_id", "")) == user_id:
                continue
            if user_id in [str(m) for m in project.get("team_members", [])]:
                continue

            proj_text = (
                f"{project.get('title', '')}. "
                f"{project.get('description', '')}. "
                f"Skills needed: {', '.join(project.get('skills_required', []))}. "
                f"Category: {project.get('category', '')}."
            )
            try:
                proj_embedding = generate_embedding(proj_text)
                sim = cosine_similarity(current_embedding, proj_embedding)
                score = round(sim * 100)
            except Exception:
                score = 0

            results.append({
                "id": pid,
                "title": project.get("title", ""),
                "description": project.get("description", ""),
                "category": project.get("category", ""),
                "stage": project.get("stage", ""),
                "skills_required": project.get("skills_required", []),
                "team_size": len(project.get("team_members", [])),
                "score": score,
                "ai_explanation": None,
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]
