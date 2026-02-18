from .evaluator_agent import evaluator_agent
from .proposal_agent import proposal_agent
from .team_agent import team_agent

def startup_ai_orchestrator(project_description, users):
    # Agent 1
    evaluation = evaluator_agent(project_description)

    # Agent 2 uses Agent 1 output
    proposal = proposal_agent(project_description, evaluation)

    # Agent 3 uses project + users
    team = team_agent(project_description, users)

    return {
        "evaluation": evaluation,
        "proposal": proposal,
        "team_suggestions": team
    }
