import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
MONGO_URI = os.getenv("MONGO_URI")
JWT_TOKEN_LOCATION = ["headers"]
JWT_HEADER_NAME = "Authorization"
JWT_HEADER_TYPE = "Bearer"
JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")