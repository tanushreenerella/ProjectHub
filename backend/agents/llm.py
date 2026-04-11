from google import genai
import os

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Mock responses for presentation demo
MOCK_RESPONSES = {
    "proposal": """
    PROJECT PROPOSAL ANALYSIS:
    
    Strengths:
    • Clear problem statement addressing real market need
    • Scalable technical architecture with modern stack
    • Strong potential for user adoption and growth
    • Well-defined success metrics
    
    Recommendations:
    • Consider partnership opportunities with existing platforms
    • Plan for monetization strategy early
    • Build MVP with core features first, then expand
    • Focus on user retention and engagement metrics
    
    Market Potential: HIGH - Estimated TAM of $50M+
    """,
    
    "team": """
    TEAM COMPOSITION ANALYSIS:
    
    Ideal Team Structure:
    • Project Lead: 1 person (Product Vision + Strategy)
    • Full-Stack Developers: 2-3 people (MVP Development)
    • UI/UX Designer: 1 person (User Experience)
    • Data/ML Engineer: 1 person (Analytics & Intelligence)
    
    Recommended Skills:
    • Backend: Node.js, Python, PostgreSQL
    • Frontend: React, TypeScript, Tailwind CSS
    • DevOps: Docker, AWS/GCP, GitHub Actions
    
    Timeline: 3-4 months to launch MVP
    Team Size: 5-7 people for rapid development
    """,
    
    "evaluation": """
    PROJECT EVALUATION REPORT:
    
    Feasibility Score: 8/10
    Market Fit Score: 8/10
    Financial Viability: 7/10
    Innovation Factor: 8/10
    
    Overall Assessment: PROMISING
    
    Key Success Factors:
    • Fast execution and MVP launch (0-3 months)
    • Strong marketing and user acquisition strategy
    • Continuous user feedback integration
    • Secure funding or bootstrap plan
    
    Risk Assessment:
    • Market competition exists but differentiation possible
    • Technical complexity manageable with right team
    • Need to validate assumptions with real users early
    
    Recommendation: PROCEED with development + parallel user research
    """
}

def run_llm(prompt: str):
    """Run LLM query with fallback to mock responses for presentation"""
    try:
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=f"You are a startup expert AI assistant.\n\n{prompt}"
        )

        return response.text

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