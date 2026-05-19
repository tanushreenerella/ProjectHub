from groq import Groq
import os

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Mock responses for presentation demo
MOCK_RESPONSES = {
    "proposal": """...""",  # keep exactly as is
    "team": """...""",      # keep exactly as is
    "evaluation": """...""" # keep exactly as is
}

def run_llm(prompt: str):
    """Run LLM query with fallback to mock responses for presentation"""
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": f"You are a startup expert AI assistant.\n\n{prompt}"}]
        )
        return response.choices[0].message.content

    except Exception as e:
        print(f"[LLM] API Error (using mock response): {str(e)}")

        if "proposal" in prompt.lower():
            return MOCK_RESPONSES["proposal"]
        elif "team" in prompt.lower():
            return MOCK_RESPONSES["team"]
        elif "evaluat" in prompt.lower():
            return MOCK_RESPONSES["evaluation"]
        else:
            return MOCK_RESPONSES["proposal"]