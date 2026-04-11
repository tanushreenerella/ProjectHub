from bson.objectid import ObjectId
from extensions import (
    projects_collection,
    tasks_collection,
    users_collection,
    project_activity_collection,
    knowledge_chunks_collection
)
from utils.embeddings import generate_embedding


def build_project_chunks(project_id: str):
    project = projects_collection.find_one({"_id": ObjectId(project_id)})
    if not project:
        return []

    chunks = []

    chunks.append({
        "project_id": ObjectId(project_id),
        "source_type": "project",
        "source_id": str(project["_id"]),
        "text": f"Project title: {project.get('title', '')}. Description: {project.get('description', '')}. Notes: {project.get('notes', '')}"
    })

    tasks = list(tasks_collection.find({
        "project_id": ObjectId(project_id),
        "archived": {"$ne": True}
    }))

    for task in tasks:
        chunks.append({
            "project_id": ObjectId(project_id),
            "source_type": "task",
            "source_id": str(task["_id"]),
            "text": f"Task: {task.get('title', '')}. Description: {task.get('description', '')}. Status: {task.get('status', '')}. Priority: {task.get('priority', '')}. Assignee: {task.get('assignee_name', '')}"
        })

    activity = list(project_activity_collection.find({
        "project_id": ObjectId(project_id)
    }).sort("created_at", -1).limit(20))

    for item in activity:
        chunks.append({
            "project_id": ObjectId(project_id),
            "source_type": "activity",
            "source_id": str(item["_id"]),
            "text": f"Activity: {item.get('message', '')}. Actor: {item.get('actor_name', '')}. Event type: {item.get('event_type', '')}"
        })

    member_ids = project.get("team_members", [])
    for member_id in member_ids:
        user = users_collection.find_one({"_id": member_id})
        if user:
            chunks.append({
                "project_id": ObjectId(project_id),
                "source_type": "member",
                "source_id": str(user["_id"]),
                "text": f"Member: {user.get('name', '')}. Role: {user.get('role', '')}. Skills: {', '.join(user.get('skills', []))}. Interests: {', '.join(user.get('interests', []))}"
            })

    return chunks


def upsert_project_knowledge(project_id: str):
    knowledge_chunks_collection.delete_many({"project_id": ObjectId(project_id)})
    chunks = build_project_chunks(project_id)

    docs = []
    for chunk in chunks:
        docs.append({
            **chunk,
            "embedding": generate_embedding(chunk["text"])
        })

    if docs:
        knowledge_chunks_collection.insert_many(docs)

    return {"chunks_indexed": len(docs)}
