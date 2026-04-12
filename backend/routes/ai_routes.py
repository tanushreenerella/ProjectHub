from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from bson.objectid import ObjectId
from extensions import (
    gemini_client,
    users_collection,
    project_activity_collection,
    projects_collection,
    tasks_collection,
)
import json
from rag.project_knowledge import upsert_project_knowledge
from rag.retriever import retrieve_project_context


ai_bp = Blueprint("ai", __name__)


def generate_idea_analysis(idea: str) -> dict:
    """Generate detailed analysis for an idea. Used as fallback when API fails."""
    idea_lower = idea.lower()
    
    has_social = any(x in idea_lower for x in ['connect', 'social', 'network', 'friends', 'community', 'team', 'match'])
    has_commerce = any(x in idea_lower for x in ['buy', 'sell', 'market', 'exchange', 'trade', 'payment'])
    has_education = any(x in idea_lower for x in ['learn', 'study', 'teach', 'education', 'course'])
    has_delivery = any(x in idea_lower for x in ['delivery', 'service', 'shipping'])
    has_ai = any(x in idea_lower for x in ['ai', 'ml', 'smart', 'intelligent'])
    
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


def _serialize_copilot_task(task):
    return {
        "title": task.get("title", ""),
        "status": task.get("status", "todo"),
        "priority": task.get("priority", "medium"),
        "type": task.get("type", "task"),
        "assignee_name": task.get("assignee_name", ""),
        "due_date": task["due_date"].isoformat() if task.get("due_date") else ""
    }


def _serialize_copilot_activity(activity):
    return {
        "event_type": activity.get("event_type", ""),
        "actor_name": activity.get("actor_name", ""),
        "message": activity.get("message", ""),
        "created_at": activity["created_at"].isoformat() if activity.get("created_at") else ""
    }


def _build_project_context(project_id):
    project = projects_collection.find_one({"_id": ObjectId(project_id)})
    if not project:
        return None

    tasks = list(tasks_collection.find({
        "project_id": ObjectId(project_id),
        "archived": {"$ne": True}
    }))

    members = []
    for member_id in project.get("team_members", []):
        user = users_collection.find_one({"_id": member_id})
        if user:
            members.append({
                "name": user.get("name", ""),
                "role": user.get("role", ""),
                "skills": user.get("skills", []),
                "interests": user.get("interests", [])
            })

    activity = list(project_activity_collection.find({
        "project_id": ObjectId(project_id)
    }).sort("created_at", -1).limit(10))

    return {
        "title": project.get("title", ""),
        "description": project.get("description", ""),
        "category": project.get("category", ""),
        "stage": project.get("stage", ""),
        "workspace_status": project.get("workspace_status", "active"),
        "workspace_priority": project.get("workspace_priority", "medium"),
        "notes": project.get("notes", ""),
        "tasks": [_serialize_copilot_task(task) for task in tasks],
        "members": members,
        "recent_activity": [_serialize_copilot_activity(item) for item in activity]
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

    prompt = f"""You are an expert startup advisor for student founders. Provide specific, actionable feedback.

You are a startup mentor AI. Analyze this student startup idea SPECIFICALLY:

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
        response = gemini_client.chat.completions.create(
      model="llama-3.1-8b-instant",  # fast & free
      messages=[{"role": "user", "content": prompt}]
      )
        content = response.choices[0].message.content.strip()
        
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        try:
            parsed = json.loads(content)
            parsed = {
                "feedback": parsed.get("feedback", ""),
                "score": min(10, max(1, int(parsed.get("score", 6)))),
                "strengths": parsed.get("strengths", [])[:3],
                "improvements": parsed.get("improvements", [])[:3],
                "businessNames": parsed.get("businessNames", [])[:5]
            }
            return jsonify(parsed)
        except json.JSONDecodeError:
            print(f"[AI] JSON parse failed, using fallback for idea: {idea[:50]}")
            return jsonify(generate_idea_analysis(idea))
            
    except Exception as e:
        print(f"[AI] API Error ({str(e)}), using fallback analysis")
        return jsonify(generate_idea_analysis(idea))


@ai_bp.route("/project-copilot", methods=["POST"])
@jwt_required()
def project_copilot():
    data = request.json or {}
    project_id = data.get("project_id")

    if not project_id:
        return jsonify({"error": "project_id is required"}), 400

    context = _build_project_context(project_id)
    if not context:
        return jsonify({"error": "Project not found"}), 404

    prompt = f"""You are a helpful startup project copilot. Be specific, practical, and grounded in the provided project context.

You are an AI project copilot for a student startup platform.

Analyze this project and return ONLY valid JSON.

PROJECT CONTEXT:
{json.dumps(context, indent=2)}

Return JSON in exactly this structure:
{{
  "summary": "2-3 sentence summary of the project health and current state",
  "healthScore": 7,
  "risks": ["risk 1", "risk 2", "risk 3"],
  "nextSteps": ["next step 1", "next step 2", "next step 3"],
  "teamInsights": ["team insight 1", "team insight 2"],
  "fundingReadiness": "1-2 sentence comment on whether the project looks ready for funding or not"
}}
"""

    try:
        response = gemini_client.chat.completions.create(
      model="llama-3.1-8b-instant",  # fast & free
      messages=[{"role": "user", "content": prompt}]
      )
        content = response.choices[0].message.content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        parsed = json.loads(content)

        return jsonify({
            "summary": parsed.get("summary", ""),
            "healthScore": min(10, max(1, int(parsed.get("healthScore", 6)))),
            "risks": parsed.get("risks", [])[:3],
            "nextSteps": parsed.get("nextSteps", [])[:3],
            "teamInsights": parsed.get("teamInsights", [])[:3],
            "fundingReadiness": parsed.get("fundingReadiness", "")
        })
    except Exception as e:
        print(f"[AI Copilot] Error: {e}")
        return jsonify({
            "summary": "This project has a usable structure but needs stronger execution tracking.",
            "healthScore": 6,
            "risks": [
                "Execution may slow down without clear task ownership",
                "Recent activity may be too low to maintain momentum",
                "Funding readiness may be premature without stronger validation"
            ],
            "nextSteps": [
                "Clarify the top 3 tasks for this week",
                "Assign owners to open tasks",
                "Document the immediate roadmap in project notes"
            ],
            "teamInsights": [
                "Check whether current members cover product, tech, and business needs",
                "Use task ownership to improve team accountability"
            ],
            "fundingReadiness": "The project may need stronger validation, clearer traction, and sharper execution evidence before funding."
        })


@ai_bp.route("/project-rag-copilot", methods=["POST"])
@jwt_required()
def project_rag_copilot():
    data = request.json or {}
    project_id = data.get("project_id")
    query = data.get("query", "").strip()

    if not project_id or not query:
        return jsonify({"error": "project_id and query are required"}), 400

    try:
        upsert_project_knowledge(project_id)
    except Exception as e:
        print(f"[RAG] upsert_project_knowledge failed: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    try:
        retrieved = retrieve_project_context(project_id, query, top_k=5)
    except Exception as e:
        print(f"[RAG] retrieve_project_context failed: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    prompt = f"""You are a project copilot. Answer the user's question using the retrieved project context below.

User Question: {query}

Retrieved Context: {json.dumps(retrieved, indent=2)}

Return a helpful, specific answer grounded in this project data.
"""

    try:
      response = gemini_client.chat.completions.create(
      model="llama-3.1-8b-instant",  # fast & free
      messages=[{"role": "user", "content": prompt}]
      )
      content = response.choices[0].message.content.strip()
      return jsonify({"answer": content, "retrieved_context": retrieved})
    except Exception as e:
        print(f"[RAG] generate_content failed: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"answer": "AI copilot could not generate a response right now.", "retrieved_context": retrieved, "error": str(e)}), 500