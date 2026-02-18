from .llm import run_llm

def proposal_agent(project_description: str, evaluation: str):
    prompt = f"""
    You are a STARTUP PROPOSAL WRITER agent.

    Project:
    {project_description}

    Investor evaluation:
    {evaluation}

    Create a professional funding proposal including:

    - Problem statement
    - Solution
    - Market opportunity
    - Business model
    - Revenue strategy
    - Future roadmap
    """

    return run_llm(prompt)
