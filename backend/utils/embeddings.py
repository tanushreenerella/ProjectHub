from google import genai
import os

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))  # keep Gemini for embeddings

def generate_embedding(text: str):
    try:
        response = _client.models.embed_content(
            model="gemini-embedding-001",
            contents=text
        )
        return response.embeddings[0].values
    except Exception as e:
        print(f"[EMBEDDING ERROR] {e}")
        raise