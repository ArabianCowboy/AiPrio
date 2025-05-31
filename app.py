from flask import Flask, request, jsonify, render_template, session
import os
import shutil
import psutil
import threading
import time
from datetime import timedelta, datetime
from gmail_service import send_email
from flask_cors import CORS
import pandas as pd
import google.generativeai as genai
from google.generativeai.types import GenerationConfig
from google.generativeai.generative_models import GenerativeModel
from google.generativeai.client import configure
import traceback
from config import Config
import functools
import uuid

# Configure the Google Generative AI SDK using our centralized config
configure(api_key=Config.GOOGLE_API_KEY)

app = Flask(__name__)
app.config.from_object(Config)
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
CORS(app)

# Ensure a secret key is set for session management
if not app.config.get('SECRET_KEY'):
    app.config['SECRET_KEY'] = os.urandom(24)
    print("WARNING: SECRET_KEY not set in config.py. Using a temporary, insecure key.")

model_instance = None  # Singleton for the AI model

@app.route('/')
def home():
    """Render the main page (index.html)."""
    return render_template('index.html')

@app.route('/about')
def about():
    """Render the About page."""
    return render_template('about.html')

@app.route('/upload', methods=['POST'])
def upload_csv():
    """
    Endpoint to upload and validate the CSV.
    Expects a form-data field named 'file'.
    """

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        # Read CSV (assumes comma-delimited)
        df = pd.read_csv(file.stream)
        # Clean headers by stripping extra spaces
        df.columns = df.columns.str.strip()

        # Define required columns to enrich prioritization evaluation.
        # This list now reflects the columns expected after the user's modification
        required_columns = [
            'Title of Your Project',
            'Directorate Submitting the Request',
            'Briefly explain the current procedure or process you are proposing for RPA or AI',
            'What is the main problem or bottleneck you are experiencing with this current process?',
            'In brief, explain your RPA or AI idea to address the problem:',
            'What type of automation are you proposing?',
            'Beyond time savings, what other benefits do you anticipate from this automation?',
            'Does this process directly impact product safety, approvals, or regulatory compliance timelines?',
            'How will you measure the success or effectiveness of this automation? List key performance indicators (KPIs):',
            'Is the data required for this automation readily available and accessible in a digital format?',
            'How does this proposed automation align with the strategic goals and objectives of your Directorate and the SFDA?',
            # 'How complex do you anticipate the integration with existing electronic systems will be?', # This column is intentionally removed from requirements
            'Approximately how many total working hours are spent on this procedure each month?',
            'How many employees currently work on this procedure?',
            'How many different electronic systems are typically used during this procedure?',
            'How many times is this procedure performed on average each month?',
            'What is the estimated reduction in total working hours per month you expect to achieve after implementing RPA or AI?'
        ]


        # Verify required columns exist in CSV
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            print(f"Upload failed. Missing columns: {missing_cols}")
            return jsonify({"error": f"Missing required columns in CSV: {', '.join(missing_cols)}"}), 400

        # Ensure the temporary directory exists
        temp_dir = os.path.join(app.root_path, 'temp')
        os.makedirs(temp_dir, exist_ok=True)

        # Generate a unique filename for the CSV
        unique_filename = f"uploaded_data_{uuid.uuid4()}.csv"
        temp_file_path = os.path.join(temp_dir, unique_filename)

        # Save the DataFrame to the temporary file
        df.to_csv(temp_file_path, index=False)

        # Store only the file path in the session
        session['df_file_path'] = temp_file_path
        # Initialize or clear analysis cache for the new session
        session['analysis_cache'] = {}

        # Build list of projects (to populate dropdown)
        requests_list = [
            {"index": int(idx), "title": row.get('Title of Your Project', f'Row {int(idx)+1} - No Title')}
            for idx, row in df.iterrows()
        ]

        return jsonify({"requests": requests_list})

    except pd.errors.EmptyDataError:
        return jsonify({"error": "CSV file is empty."}), 400
    except Exception as e:
        print(f"Error processing CSV: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Error processing CSV file: {e}"}), 500

@app.route('/preview_request/<int:row_index>', methods=['GET'])
def preview_request(row_index):
    """
    Returns the raw details (all columns) for a single row (selected request)
    with missing values (NaN) replaced by None for valid JSON output.
    """
    df_file_path = session.get('df_file_path')
    if df_file_path is None:
        return jsonify({"error": "No CSV uploaded or processed yet in this session."}), 400

    try:
        df = pd.read_csv(df_file_path)
    except FileNotFoundError:
        return jsonify({"error": "Uploaded CSV file not found on server. Please re-upload."}), 404
    except Exception as e:
        return jsonify({"error": f"Error reading CSV from file: {e}"}), 500

    if df.empty:
        return jsonify({"error": "Uploaded data is empty or corrupted."}), 400

    if row_index < 0 or row_index >= len(df):
        return jsonify({"error": "Row index out of range."}), 400

    # Retrieve the row as a Series
    row_series = df.iloc[row_index]
    # Replace NaN with None (so it serializes to null in JSON)
    row_data = row_series.where(row_series.notna(), None).to_dict()
    return jsonify(row_data)

# Performance monitoring decorator
def timing_decorator(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        execution_time = end_time - start_time
        print(f"Function {func.__name__} took {execution_time:.2f} seconds to execute")
        return result
    return wrapper

# Get or create the AI model instance (singleton pattern)
def get_model():
    global model_instance
    if model_instance is None:
        print("Initializing new AI model instance")
        model_instance = GenerativeModel(
            Config.GENAI_MODEL_NAME,
            generation_config=GenerationConfig(
                temperature=0.9,
                top_p=0.01,
                top_k=2,
                max_output_tokens=Config.MAX_OUTPUT_TOKENS
            ),
            safety_settings=[
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
            ]
        )
    return model_instance

@app.route('/prioritize/<int:row_index>', methods=['GET'])
@timing_decorator
def prioritize_single(row_index):
    """
    Generates an AI-based analysis for the selected row.
    Uses Google Generative AI to produce a Markdown table (with embedded heat map markup) and a conclusion.
    Implements caching to avoid redundant AI calls for the same row.
    """
    df_file_path = session.get('df_file_path')
    analysis_cache = session.get('analysis_cache', {})

    if df_file_path is None:
        return jsonify({"error": "No CSV uploaded or processed yet in this session."}), 400

    try:
        df = pd.read_csv(df_file_path)
    except FileNotFoundError:
        return jsonify({"error": "Uploaded CSV file not found on server. Please re-upload."}), 404
    except Exception as e:
        return jsonify({"error": f"Error reading CSV from file: {e}"}), 500

    if df.empty:
        return jsonify({"error": "Uploaded data is empty or corrupted."}), 400

    if row_index < 0 or row_index >= len(df):
        return jsonify({"error": "Row index out of range."}), 400

    # Check if we already have this analysis cached
    if row_index in analysis_cache:
        print(f"Using cached analysis for row {row_index}")
        return jsonify(analysis_cache[row_index])

    try:
        # Use .loc for better performance with a single row
        row = df.loc[row_index]

        # Helper function to safely retrieve a column's value.
        def get_safe(key, default="N/A"):
            # Check if the key exists in the row before accessing it
            if key in row and pd.notna(row.loc[key]):
                 return row.loc[key]
            return default

        # Reconstructed prompt with the "Enhancement Suggestions" section restored
        prompt = f"""You are an SFDA Pharmacist Business Analyst created by Mohammed Fouda your job is evaluating an AI automation request.
As a pharmacist within the Saudi Food and Drug Authority (SFDA), consider the impact on regulatory compliance, patient safety, and pharmaceutical quality.

Please produce your analysis as follows:

1. A single **Markdown table** with columns: **Category**, **Rating**,, **Rating %** and **Justification**.
    For the **Rating** column, please use one of the following values: "Very High", "High", "Medium", "Low", or "Very Low".
    For the **Rating %** column, use the following values objuctively based on the rating:
    - For 'Very High', select a specific percentage between 90% and 100% (e.g., 95%).
    - For 'High', select a specific percentage between 75% and 89% (e.g., 85%).
    - For 'Medium', select a specific percentage between 50% and 74% (e.g., 65%).
    - For 'Low', select a specific percentage between 25% and 49% (e.g., 35%).
    - For 'Very Low', select a specific percentage between 0% and 24% (e.g., 15%).
    Crucially, wrap each rating text in an HTML span element with a class corresponding to the rating level in lowercase with hyphens.
    For example, if the rating is High, output: <span class="rating-high">High</span>.
    Each row should represent one of the following categories:

    **1. Strategic Alignment**
    Provide at least 4 sentences discussing how well the request aligns with SFDA's Fourth Strategic Plan (2023-2027). Consider the following three strategic themes:
       - **Products Safety:** Ensuring the safety and quality of regulated products by developing regulatory systems, improving communication and awareness, and establishing controls for new technology and biotech products.
       - **Local and International Partnerships:** Enhancing product availability, boosting international leadership, supporting research and innovation, and enabling investor engagement.
       - **Operational Excellence:** Improving internal operations by diversifying income resources, developing human capital, and increasing the use of advanced digital technology.
    Based on the number of these strategic themes the request addresses:
       - If it aligns with 1 theme, assign a rating of **Medium** (e.g., "Medium (60%)").
       - If it aligns with 2 themes, assign a rating of **High** (e.g., "High (85%)").
       - If it aligns with all 3 themes, assign a rating of **Very High** (e.g., "Very High (95%)").


    **2. Potential Impact**
    Provide at least 4 sentences on expected benefits (efficiency, compliance, public health), including quantitative estimates if available.

    **3. Complexity & Implementation Difficulty**
    Provide at least 4 sentences on anticipated challenges such as integration issues and data availability.

    **4. Urgency & Necessity**
    Provide at least 3 sentences explaining any time sensitivity.

    **5. Risk & Challenges**
    Provide at least 3 sentences discussing potential risks or barriers.

    **6. Hours Spent each month**
     - Use numeric anchors if given (approximate if text):
 • 1–10 => Very Low
 • 11–20 => Low
 • 21–30 => Medium
 • 31–40 => High
 • 41+ => Very High
     Provide 3+ sentences on workload implications, ROI, etc. couse the AI or RPA will reduce the number of hours needed to do the task.

    **7. Number of Employees**
- Use numeric anchors (approximate if text):
 • 1–2 => Very Low
 • 3–5 => Low
 • 6–10 => Medium
 • 11–15 => High
 • 16+ => Very High
     Provide 3+ sentences referencing workforce impact or resource availability for example if many employees are involved then it is a high impact. couse the the AI or RPA will reduce the number of employees needed to do the task.

    **8. Number of Systems**
- Fewer systems = simpler (approximate if text):
 • 0 => Very High (extremely simple)
 • 1 => High
 • 2 => Medium
 • 3 => Low
 • 4+ => Very Low (complex)
     Provide 3+ sentences discussing integration complexity. cous the more complex the system the more time it will take to integrate the AI or RPA with the system.

    **9. Stakeholders Impacted**
- Use numeric anchors (approximate if text):
 • 1 => Very Low
 • 2–3 => Low
 • 4–5 => Medium
 • 6–7 => High
 • 8+ => Very High
Provide 3+ sentences explaining who is involved, potential collaboration, or cross-department benefits. for example more department get benfit from th AI or RPA the greater the the impact of reducing workload .

    **10. Overall Priority**
    Synthesize the above points in at least 7 sentences, with explicit quantitative references.

**PART 2: Conclusion**
Immediately after the table, include a 4–5 sentence concluding paragraph under the exact Markdown heading `## Conclusion`.
This paragraph must summarize key takeaways from the analysis and recommend next steps (e.g., pilot testing, further data validation, stakeholder consultation).

**PART 3: Enhancement Suggestions**
CRITICAL AND MANDATORY: Immediately after the Conclusion, you MUST add a new section with the exact Markdown heading `## Enhancement Suggestions`.
Under this heading, provide 1 to 3 concise, actionable suggestions to improve or expand upon the "RPA or AI idea" described in the "Request Details".
These suggestions should be practical and aim to add more value or address potential gaps. Consider aspects such as:
    - Leveraging additional data sources not mentioned.
    - Exploring complementary AI techniques (e.g., Natural Language Processing, Machine Learning for prediction, Computer Vision if applicable).
    - Ways to mitigate identified risks or challenges.
    - Ideas for improving user experience or the integration of the proposed solution.
    - Expanding the scope of the automation to cover related tasks.
Each suggestion should be clearly explained in 1-2 sentences.

----
**Request Details:**
Title: {get_safe('Title of Your Project')}
Directorate: {get_safe('Directorate Submitting the Request')}
Procedure Description: {get_safe('Briefly explain the current procedure or process you are proposing for RPA or AI')}
Main Problem: {get_safe('What is the main problem or bottleneck you are experiencing with this current process?')}
Automation Proposal: {get_safe('In brief, explain your RPA or AI idea to address the problem:')}
Automation Type: {get_safe('What type of automation are you proposing?')}
Estimated Reduction in Working Hours: {get_safe('What is the estimated reduction in total working hours per month you expect to achieve after implementing RPA or AI?')}
Additional Benefits: {get_safe('Beyond time savings, what other benefits do you anticipate from this automation?')}
KPIs: {get_safe('How will you measure the success or effectiveness of this automation? List key performance indicators (KPIs):')}
Data Readiness: {get_safe('Is the data required for this automation readily available and accessible in a digital format?')}
Strategic Alignment: {get_safe('How does this proposed automation align with the strategic goals and objectives of your Directorate and the SFDA?')}
Working Hours: {get_safe('Approximately how many total working hours are spent on this procedure each month?')}
Employee Count: {get_safe('How many employees currently work on this procedure?')}
System Count: {get_safe('How many different electronic systems are typically used during this procedure?')}
Procedure Frequency: {get_safe('How many times is this procedure performed on average each month?')}
"""

        # Use the singleton model instance instead of creating a new one each time
        model = get_model()

        # Generate content with the model
        response = model.generate_content(prompt)

        try:
            analysis_text = response.text.strip()
        except ValueError:
            print(f"Warning: Gemini response blocked or empty for row {row_index}. Prompt feedback: {response.prompt_feedback}")
            analysis_text = f"Error: The response from the AI model was blocked or empty. Reason: {response.prompt_feedback}"

        result_data = {
            "index": row_index,
            "title": get_safe('Title of Your Project'),
            "directorate": get_safe('Directorate Submitting the Request'),
            "analysis": analysis_text
        }

        # Store the most recent analysis in the app context (deprecated in multi-user approach)
        # app.recent_analysis = analysis_text # Removed this line as it's not multi-user safe

        # Cache the result for future requests
        analysis_cache[row_index] = result_data
        session['analysis_cache'] = analysis_cache # Store updated cache back in session

        return jsonify(result_data)

    except KeyError as e:
        print(f"KeyError accessing data for row {row_index}: {e}")
        # Check if the missing key was the one we intentionally removed from requirements
        # If it was, this error means the CSV is missing some OTHER column.
        # If it wasn't, this error means the CSV is missing one of the columns still required.
        if str(e) == "'How complex do you anticipate the integration with existing electronic systems will be?'":
             # This error should ideally not happen now that it's not in required_columns,
             # but leaving this check just in case the prompt was modified elsewhere.
             error_message = f"An internal error occurred. The required column '{e}' was not found when generating the AI prompt."
        else:
            error_message = f"Missing expected data column {e} in the uploaded CSV for the selected row. Please ensure the CSV contains all required columns."

        return jsonify({"error": error_message}), 400
    except Exception as e:
        print(f"An unexpected error occurred for row {row_index}: {e}")
        traceback.print_exc()
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500


@app.route('/chat', methods=['POST'])
@timing_decorator
def chat():
    """
    Endpoint for chatbot interaction. Accepts user queries and returns LLM-generated responses.
    Expects a JSON payload with "query" and "analysis" (the latter passed from LocalStorage).
    Uses the singleton model instance for better performance.
    """
    data = request.get_json()
    user_query = data.get('query', '').strip()
    frontend_analysis = data.get('analysis', '').strip()

    if not user_query:
        return jsonify({"error": "Query cannot be empty."}), 400

    try:
        if frontend_analysis:
            context = f"The analysis results are available. Here is the most recent analysis: {frontend_analysis}"
        else:
            context = "There are currently no analysis results to explain because no analysis was provided."

        prompt = f"""
        You are an AI assistant helping users understand analysis results. Here is the context:
        {context}

        User Query: {user_query}

        Provide a clear and concise response to the user's query.
        """

        # Use the singleton model instance instead of creating a new one each time
        model = get_model()

        # Generate content with the model
        response = model.generate_content(prompt)

        chatbot_response = response.text.strip()
        return jsonify({"response": chatbot_response})

    except Exception as e:
        print(f"Error generating chatbot response: {e}")
        traceback.print_exc()
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500

@app.route('/chat/clear', methods=['POST'])
@timing_decorator
def clear_chat_history():
    """
    Endpoint to clear the chat history state (on the server, though current chat is frontend only).
    This specific endpoint doesn't affect the frontend LocalStorage history.
    It currently only clears the global DataFrame, which isn't directly "chat history".
    Leaving as is for now, but acknowledge its limited effect.
    """
    try:
        # Remove the file from the temporary directory if it exists
        df_file_path = session.pop('df_file_path', None)
        if df_file_path and os.path.exists(df_file_path):
            os.remove(df_file_path)
            print(f"Removed temporary file: {df_file_path}")

        session.pop('analysis_cache', None)
        return jsonify({"message": "Session data (CSV file and analysis cache) cleared successfully."}), 200
    except Exception as e:
        print(f"Error clearing server state: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to clear server state: {e}"}), 500

@app.route('/analysis/clear', methods=['POST'])
@timing_decorator
def clear_analysis_cache():
    """
    Endpoint to clear the analysis cache.
    This allows users to free up memory and force fresh analyses.
    """
    try:
        # Clear the session-specific analysis cache
        session['analysis_cache'] = {}
        return jsonify({"message": "Session analysis cache cleared successfully."}), 200
    except Exception as e:
        print(f"Error clearing analysis cache: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to clear analysis cache: {e}"}), 500

@app.route('/send-report', methods=['POST'])
@timing_decorator
def send_report():
    """
    Endpoint to send analysis report via email as PDF.
    Expects JSON with:
    - email: recipient email address
    - pdf: base64 encoded PDF content
    """
    data = request.get_json()
    email = data.get('email')
    pdf_base64 = data.get('pdf')

    if not email or not pdf_base64:
        return jsonify({"error": "Email and PDF content are required"}), 400

    try:
        # The actual send_email function needs to be implemented in gmail_service.py
        # Assuming it takes recipient, subject, body, and pdf (base64)
        send_email(
            recipient=email,
            subject="AiPrio Analysis Report",
            body="Please find attached your analysis report",
            pdf=pdf_base64
        )
        return jsonify({"message": "PDF report sent successfully"}), 200
    except Exception as e:
        print(f"Error sending email: {e}")
        traceback.print_exc()
        # More specific error handling might be needed based on send_email implementation
        return jsonify({"error": f"Failed to send email: {e}"}), 500


# Configuration for cleanup and monitoring
TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp')
FILE_CLEANUP_AGE_HOURS = 24
STORAGE_THRESHOLD_PERCENT = 90
CLEANUP_INTERVAL_HOURS = 6 # Run cleanup every 6 hours
STORAGE_CHECK_INTERVAL_HOURS = 1 # Check storage every 1 hour

def cleanup_old_files_and_sessions(priority=False):
    """
    Deletes files in the temp/ directory older than FILE_CLEANUP_AGE_HOURS.
    If priority is True, it might be more aggressive (though not implemented yet).
    """
    print(f"[{datetime.now()}] Starting cleanup of old files in {TEMP_DIR} (Priority: {priority})...")
    if not os.path.exists(TEMP_DIR):
        print(f"[{datetime.now()}] Temp directory {TEMP_DIR} does not exist. Skipping cleanup.")
        return

    now = time.time()
    cutoff_time = now - (FILE_CLEANUP_AGE_HOURS * 3600) # Convert hours to seconds

    deleted_count = 0
    for filename in os.listdir(TEMP_DIR):
        file_path = os.path.join(TEMP_DIR, filename)
        if os.path.isfile(file_path):
            try:
                file_age = os.stat(file_path).st_mtime
                if file_age < cutoff_time:
                    os.remove(file_path)
                    deleted_count += 1
                    print(f"[{datetime.now()}] Deleted old file: {filename}")
            except Exception as e:
                print(f"[{datetime.now()}] Error deleting file {filename}: {e}")
    print(f"[{datetime.now()}] Finished cleanup. Deleted {deleted_count} old files.")

def check_server_storage():
    """
    Checks server disk usage and triggers cleanup if a threshold is exceeded.
    """
    print(f"[{datetime.now()}] Checking server storage...")
    try:
        # Get disk usage for the root partition (or the drive where the app is running)
        # On Windows, this might be 'C:\\' or similar. psutil handles this cross-platform.
        disk_usage = psutil.disk_usage('/')
        percent_used = disk_usage.percent
        print(f"[{datetime.now()}] Disk usage: {percent_used}%")

        if percent_used > STORAGE_THRESHOLD_PERCENT:
            print(f"[{datetime.now()}] Disk usage {percent_used}% exceeds threshold {STORAGE_THRESHOLD_PERCENT}%. Triggering priority cleanup.")
            cleanup_old_files_and_sessions(priority=True)
        else:
            print(f"[{datetime.now()}] Disk usage {percent_used}% is within acceptable limits.")
    except Exception as e:
        print(f"[{datetime.now()}] Error checking server storage: {e}")

def start_background_tasks():
    """
    Starts the periodic background tasks for cleanup and storage monitoring.
    """
    # Schedule cleanup task
    def schedule_cleanup():
        with app.app_context():
            cleanup_old_files_and_sessions()
        # Reschedule itself
        threading.Timer(CLEANUP_INTERVAL_HOURS * 3600, schedule_cleanup).start()

    # Schedule storage check task
    def schedule_storage_check():
        with app.app_context():
            check_server_storage()
        # Reschedule itself
        threading.Timer(STORAGE_CHECK_INTERVAL_HOURS * 3600, schedule_storage_check).start()

    # Start the timers immediately
    threading.Timer(10, schedule_cleanup).start() # Start cleanup after 10 seconds
    threading.Timer(5, schedule_storage_check).start() # Start storage check after 5 seconds
    print(f"[{datetime.now()}] Background cleanup and storage monitoring tasks scheduled.")


if __name__ == '__main__':
    # Create the temp directory if it doesn't exist
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    # Start background tasks in a separate thread
    # This ensures the main Flask app thread is not blocked
    background_thread = threading.Thread(target=start_background_tasks)
    background_thread.daemon = True # Allow the main program to exit even if threads are running
    background_thread.start()

    app.run(
        debug=app.config.get("FLASK_DEBUG", False),
        host=app.config.get("FLASK_HOST", "127.0.0.1"),
        port=5000  # Fixed port for OAuth compatibility
    )