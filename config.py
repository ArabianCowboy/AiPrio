import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env

class Config:
    """
    Centralized configuration class for the Flask app, 
    including environment variables and generative AI settings.
    """
    # Basic Flask config
    FLASK_DEBUG = True
    FLASK_HOST = "0.0.0.0"
    FLASK_PORT = 5000

    # Google Generative AI
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

    # Model name for Gemini 1.5 Flash (latest)
    #GENAI_MODEL_NAME = "gemini-1.5-flash-latest"
    GENAI_MODEL_NAME = "gemini-2.0-flash"

    # According to the documentation for gemini-1.5-flash, 
    # set the maximum output tokens to the highest available limit.
    MAX_OUTPUT_TOKENS = 8000  # Adjust if your model supports a different limit
