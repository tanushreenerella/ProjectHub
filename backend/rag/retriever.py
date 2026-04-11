from math import sqrt
from bson.objectid import ObjectId
from extensions import knowledge_chunks_collection
from utils.embeddings import generate_embedding


def cosine_similarity(vec1, vec2):
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sqrt(sum(a * a for a in vec1))
    norm2 = sqrt(sum(b * b for b in vec2))
    if norm1 == 0 or norm2 == 0:
        return 0
    return dot / (norm1 * norm2)


def retrieve_project_context(project_id: str, query: str, top_k: int = 5):
    query_embedding = generate_embedding(query)

    docs = list(knowledge_chunks_collection.find({
        "project_id": ObjectId(project_id)
    }))

    scored = []
    for doc in docs:
        score = cosine_similarity(query_embedding, doc.get("embedding", []))
        scored.append((score, doc))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "source_type": doc.get("source_type", ""),
            "text": doc.get("text", ""),
            "score": score
        }
        for score, doc in scored[:top_k]
    ]
