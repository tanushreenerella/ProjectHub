from utils.embeddings import generate_embedding
from rag.faiss_store import search_project_index


def retrieve_project_context(project_id: str, query: str, top_k: int = 5):
    query_embedding = generate_embedding(query)
    results = search_project_index(project_id, query_embedding, top_k=top_k)

    return [
        {
            "source_type": item.get("source_type", ""),
            "text": item.get("text", ""),
            "score": item.get("distance", 0.0)
        }
        for item in results
    ]
