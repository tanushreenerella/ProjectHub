import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
import joblib
import random

# -------- CREATE SYNTHETIC DATASET --------

data = []

for _ in range(300):
    team_size = random.randint(1, 6)
    skills_count = random.randint(1, 10)
    has_prototype = random.randint(0, 1)
    stage = random.randint(0, 2)  
    # 0=idea, 1=prototype, 2=launched
    connections = random.randint(0, 20)

    # simple logic for "viability"
    score = (
        team_size * 2 +
        skills_count * 1.5 +
        has_prototype * 5 +
        stage * 4 +
        connections * 0.3
    )

    viability = 1 if score > 15 else 0

    data.append([
        team_size,
        skills_count,
        has_prototype,
        stage,
        connections,
        viability
    ])

df = pd.DataFrame(data, columns=[
    "team_size",
    "skills_count",
    "has_prototype",
    "stage",
    "connections",
    "viable"
])

# -------- TRAIN MODEL --------

X = df.drop("viable", axis=1)
y = df["viable"]

model = LogisticRegression()
model.fit(X, y)

# -------- SAVE MODEL --------

joblib.dump(model, "backend/ml/viability_model.pkl")

print("Model trained and saved!")
