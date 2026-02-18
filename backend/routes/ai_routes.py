from flask import Blueprint, request, jsonify
from extensions import openai_client
import json
import re

ai_bp = Blueprint("ai", __name__)

def generate_idea_analysis(idea: str) -> dict:
    """Generate detailed analysis for an idea. Used as fallback when API fails."""
    idea_lower = idea.lower()
    
    # Analyze the idea to extract key concepts
    has_social = any(x in idea_lower for x in ['connect', 'social', 'network', 'friends', 'community', 'team', 'match'])
    has_commerce = any(x in idea_lower for x in ['buy', 'sell', 'market', 'exchange', 'trade', 'payment'])
    has_education = any(x in idea_lower for x in ['learn', 'study', 'teach', 'education', 'course'])
    has_delivery = any(x in idea_lower for x in ['delivery', 'service', 'shipping'])
    has_ai = any(x in idea_lower for x in ['ai', 'ml', 'smart', 'intelligent'])
    
    # Generate specific, contextual strengths
    strengths = []
    if has_social:
        strengths.extend(["Network effects enable rapid growth", "Strong community engagement potential"])
    if has_commerce:
        strengths.extend(["Clear revenue opportunity", "Proven market demand"])
    if has_education:
        strengths.extend(["Large student market", "High engagement potential"])
    if has_delivery:
        strengths.extend(["Operational efficiency gains", "Strong unit economics"])
    if has_ai:
        strengths.extend(["Leverages emerging tech", "Competitive differentiation"])
    if not strengths:
        strengths = ["Addresses real pain point", "Target market is engaged"]
    
    # Generate specific improvements
    improvements = []
    if not has_commerce:
        improvements.append("Define monetization strategy and pricing model")
    if not has_ai and has_commerce:
        improvements.append("Add automation/intelligence to differentiate")
    if len(idea) < 100:
        improvements.append("Describe competitive landscape and your differentiation")
    else:
        improvements.append("Validate problem with target users before coding")
    
    improvements.extend([
        "Create MVP roadmap with 3-5 core features",
        "Estimate customer acquisition costs and lifetime value"
    ])
    
    # Generate names related to idea content
    name_suggestions = []
    if 'textbook' in idea_lower or 'book' in idea_lower:
        name_suggestions = ['BookSwap', 'TextMate', 'CampusPages', 'StudyExchange', 'BudgetBooks']
    elif 'food' in idea_lower or 'delivery' in idea_lower or 'eat' in idea_lower:
        name_suggestions = ['CampusEats', 'DormFresh', 'SnackHub', 'LocalDeliver', 'BiteFlow']
    elif has_social or 'network' in idea_lower or 'team' in idea_lower:
        name_suggestions = ['ConnectHub', 'CampusSync', 'TeamMate', 'CollegeMate', 'PeerLink']
    elif has_education or 'study' in idea_lower:
        name_suggestions = ['StudyHub', 'LearnTogether', 'AcademiX', 'EduMate', 'ClassSync']
    else:
        name_suggestions = ['StartupHub', 'InnovateLabs', 'CampusVenture', 'HubFlow', 'LaunchPad']
    
    score = min(10, max(6, 7 + (len(strengths) - 2)))
    
    feedback = f"""🚀 **Problem & Solution**: Your idea identifies a concrete gap in {['peer connectivity', 'commerce', 'education', 'service delivery', 'technology'][score % 5]}. The solution approach is focused on solving a specific, measurable problem for students.

🎯 **Market Potential**: The student market is highly engaged and values solutions that save time, money, or bring people together. Your direction shows understanding of campus dynamics.

💡 **Path Forward**: Validate your core assumption with 5-10 target users. Build an MVP with only essential features. Get real feedback before adding complexity.

**Key Metrics**: Track user retention, cost per acquisition, and problem-solution fit before raising capital or scaling."""
    
    return {
        "feedback": feedback,
        "score": score,
        "strengths": strengths[:3],
        "improvements": improvements[:3],
        "businessNames": name_suggestions
    }

@ai_bp.route("/improve-proposal", methods=["POST"])
def improve_proposal():
    idea = request.json.get("idea", "").strip()
    
    if not idea or len(idea) < 15:
        return jsonify({
            "feedback": "Please provide a more detailed description of your idea.",
            "score": 0,
            "strengths": [],
            "improvements": ["Describe the problem you're solving", "Who is your target user"],
            "businessNames": []
        }), 400

    prompt = f"""You are a startup mentor AI. Analyze this student startup idea SPECIFICALLY:

IDEA: "{idea}"

Provide detailed analysis tailored to THIS exact idea, not generic feedback.

Return ONLY valid JSON (no markdown, no code blocks):

{{
  "feedback": "2-3 sentences analyzing strengths, weaknesses, and market potential SPECIFIC to this idea",
  "score": 7,
  "strengths": ["strength1 specific to this idea", "strength2 specific to this idea", "strength3 specific to this idea"],
  "improvements": ["improvement1 specific to this idea", "improvement2 specific to this idea", "improvement3 specific to this idea"],
  "businessNames": ["name1", "name2", "name3", "name4", "name5"]
}}"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert startup advisor for student founders. Provide specific, actionable feedback."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=700,
            temperature=0.8
        )

        content = response.choices[0].message.content.strip()
        
        # Remove markdown code blocks if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        try:
            parsed = json.loads(content)
            # Ensure all fields exist
            parsed = {
                "feedback": parsed.get("feedback", ""),
                "score": min(10, max(1, int(parsed.get("score", 6)))),
                "strengths": parsed.get("strengths", [])[:3],
                "improvements": parsed.get("improvements", [])[:3],
                "businessNames": parsed.get("businessNames", [])[:5]
            }
            return jsonify(parsed)
        except json.JSONDecodeError:
            # Use fallback if JSON parsing fails
            print(f"[AI] JSON parse failed, using fallback for idea: {idea[:50]}")
            return jsonify(generate_idea_analysis(idea))
            
    except Exception as e:
        # API error - use intelligent fallback
        print(f"[AI] API Error ({str(e)}), using fallback analysis")
        return jsonify(generate_idea_analysis(idea))
