import os
import json
import faiss
import numpy as np

BASE_DIR = os.path.dirname(__file__)
INDEX_DIR = os.path.join(BASE_DIR, "indexes")
os.makedirs(INDEX_DIR, exist_ok=True)


def _index_path(project_id: str):
    return os.path.join(INDEX_DIR, f"{project_id}.index")


def _meta_path(project_id: str):
    return os.path.join(INDEX_DIR, f"{project_id}_meta.json")


def save_project_index(project_id: str, embeddings: list[list[float]], metadata: list[dict]):
    if not embeddings:
        return {"indexed": 0}

    vectors = np.array(embeddings, dtype="float32")
    dimension = vectors.shape[1]

    index = faiss.IndexFlatL2(dimension)
    index.add(vectors)

    faiss.write_index(index, _index_path(project_id))

    with open(_meta_path(project_id), "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    return {"indexed": len(metadata)}


def load_project_index(project_id: str):
    index_file = _index_path(project_id)
    meta_file = _meta_path(project_id)

    if not os.path.exists(index_file) or not os.path.exists(meta_file):
        return None, []

    index = faiss.read_index(index_file)

    with open(meta_file, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    return index, metadata


def search_project_index(project_id: str, query_embedding: list[float], top_k: int = 5):
    index, metadata = load_project_index(project_id)
    if index is None or not metadata:
        return []

    query_vector = np.array([query_embedding], dtype="float32")
    distances, indices = index.search(query_vector, top_k)

    results = []
    for rank, idx in enumerate(indices[0]):
        if idx == -1 or idx >= len(metadata):
            continue

        item = metadata[idx]
        results.append({
            **item,
            "distance": float(distances[0][rank])
        })

    return results
