from .llm import run_llm

def team_agent(project_description: str, users: list):
    prompt = f"""
    You are an AI HR STRATEGIST agent.

    Project:
    {project_description}

    Available people and skills:
    {users}

    Suggest:
    - Missing skills
    - Ideal team structure
    - Best candidates from list
    """

    return run_llm(prompt)
