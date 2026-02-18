from .llm import run_llm

def evaluator_agent(project_description: str):
    prompt = f"""
    You are an AI INVESTOR agent.

    Your job:
    Evaluate startup ideas.

    Project:
    {project_description}

    Return:
    - Innovation score /10
    - Market demand /10
    - Technical complexity /10
    - Funding potential /10
    - Key risks
    - 3 improvements
    """

    return run_llm(prompt)
