from flask import Flask, request, jsonify, render_template
from gmail_service import send_email
from flask_cors import CORS
import pandas as pd
import google.generativeai as genai
import traceback
from config import Config
import time
import functools

# Configure the Google Generative AI SDK using our centralized config
genai.configure(api_key=Config.GOOGLE_API_KEY)

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

# Global variables to store data and cache results
df_global = None
analysis_cache = {}  # Cache for storing analysis results by row_index
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
    global df_global

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        # Read CSV (assumes comma-delimited)
        df = pd.read_csv(file)
        # Clean headers by stripping extra spaces
        df.columns = df.columns.str.strip()

        # Define required columns to enrich prioritization evaluation.
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
            'How complex do you anticipate the integration with existing electronic systems will be?',
            'Approximately how many total working hours are spent on this procedure each month?',
            'How many employees currently work on this procedure?',
            'How many different electronic systems are typically used during this procedure?',
            'How many times is this procedure performed on average each month?',
            'What is the estimated reduction in total working hours per month you expect to achieve after implementing RPA or AI?',
            'Who are the key stakeholders (individuals or departments) that would be positively impacted by this automation?'
        ]

        # Verify required columns exist in CSV
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            print(f"Upload failed. Missing columns: {missing_cols}")
            return jsonify({"error": f"Missing required columns in CSV: {', '.join(missing_cols)}"}), 400

        # Save DataFrame in global variable
        df_global = df

        # Build list of projects (to populate dropdown)
        requests_list = [
            {"index": idx, "title": row.get('Title of Your Project', f'Row {idx+1} - No Title')}
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
    global df_global
    if df_global is None:
        return jsonify({"error": "No CSV uploaded or processed yet."}), 400

    if row_index < 0 or row_index >= len(df_global):
        return jsonify({"error": "Row index out of range."}), 400

    # Retrieve the row as a Series
    row_series = df_global.iloc[row_index]
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
        model_instance = genai.GenerativeModel(
            Config.GENAI_MODEL_NAME,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
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
    global df_global, analysis_cache
    if df_global is None:
        return jsonify({"error": "No CSV uploaded or processed yet."}), 400
    if not isinstance(df_global, pd.DataFrame):
        return jsonify({"error": "Uploaded data is not in the expected format."}), 400
    if row_index < 0 or row_index >= len(df_global):
        return jsonify({"error": "Row index out of range."}), 400
    
    # Check if we already have this analysis cached
    if row_index in analysis_cache:
        print(f"Using cached analysis for row {row_index}")
        return jsonify(analysis_cache[row_index])
        
    try:
        # Use .loc for better performance with a single row
        row = df_global.loc[row_index]

        # Helper function to safely retrieve a column's value.
        def get_safe(key, default="N/A"):
            value = row.get(key, default) if pd.notna(row.get(key)) else default
            # Special handling for stakeholder field
            if key == 'Who are the key stakeholders (individuals or departments) that would be positively impacted by this automation?  ':
                if value in ["N/A", "None", "na", "n/a"]:
                    return ""
                # Split comma-separated stakeholders and clean up
                stakeholders = [s.strip() for s in str(value).split(',') if s.strip()]
                return ', '.join(stakeholders) if stakeholders else ""
            return value

        prompt = f"""You are an SFDA Pharmacist Business Analyst created by Mohammed Fouda your job is evaluating an AI automation request.
As a pharmacist within the Saudi Food and Drug Authority (SFDA), consider the impact on regulatory compliance, patient safety, and pharmaceutical quality.

Please produce your analysis as follows:

1.  Output a single, valid **Markdown table** with columns: **Category**, **Rating**, **Rating %**, and **Justification**.
    -   Ensure all analysis content for categories 1-10 is INSIDE the table cells.
    -   The table must be properly formatted Markdown.
    -   For the **Rating** column, use one of: "Very High", "High", "Medium", "Low", or "Very Low".
    -   For the **Rating %** column, use:
        -   'Very High': 90%–100%
        -   'High': 75%–89%
        -   'Medium': 50%–74%
        -   'Low': 25%–49%
        -   'Very Low': 0%–24%
    -   Wrap each rating text in an HTML span element with a class corresponding to the rating level in lowercase with hyphens (e.g., `<span class="rating-high">High</span>`).
    -   Each row should represent one of the following categories.

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
    *
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

**9. Key Stakeholders**
- CRITICAL: Use ONLY the value from "KEY STAKEHOLDERS FOR ANALYSIS" below. Do NOT use the "Directorate".
- Count the distinct stakeholders listed in "KEY STAKEHOLDERS FOR ANALYSIS":
 • 0-1 => Very Low
 • 2–3 => Low
 • 4–5 => Medium
 • 6–7 => High
 • 8+ => Very High
- In the Justification column:
    - If stakeholders are listed: State "Key stakeholders identified: [List stakeholders from 'KEY STAKEHOLDERS FOR ANALYSIS']. Impact breadth is [Rating] based on [Number] stakeholders."
    - If NO stakeholders are listed (field is empty): State exactly "No specific stakeholders listed in the request."

    **10. Overall Priority**
    Synthesize the above points in at least 7 sentences, with explicit quantitative references.

2.  After the table, include a **4–5 sentence concluding paragraph** under the Markdown heading `## Conclusion`. This paragraph must summarize key takeaways and recommend next steps (e.g., pilot testing, data validation).

3.  The entire response, including the table and the conclusion, must be valid Markdown.

----
**Request Details:**
Title: {get_safe('Title of Your Project')}
Directorate: {get_safe('Directorate Submitting the Request')} (NOTE: This is NOT the stakeholder list)
Procedure Description: {get_safe('Briefly explain the current procedure or process you are proposing for RPA or AI')}
Main Problem: {get_safe('What is the main problem or bottleneck you are experiencing with this current process?')}
Automation Proposal: {get_safe('In brief, explain your RPA or AI idea to address the problem:')}
Automation Type: {get_safe('What type of automation are you proposing?')}
Estimated Reduction in Working Hours: {get_safe('What is the estimated reduction in total working hours per month you expect to achieve after implementing RPA or AI?')}
Additional Benefits: {get_safe('Beyond time savings, what other benefits do you anticipate from this automation?')}
KPIs: {get_safe('How will you measure the success or effectiveness of this automation? List key performance indicators (KPIs):')}
Data Readiness: {get_safe('Is the data required for this automation readily available and accessible in a digital format?')}
Strategic Alignment: {get_safe('How does this proposed automation align with the strategic goals and objectives of your Directorate and the SFDA?')}
Integration Complexity: {get_safe('How complex do you anticipate the integration with existing electronic systems will be?')}
Working Hours: {get_safe('Approximately how many total working hours are spent on this procedure each month?')}
Employee Count: {get_safe('How many employees currently work on this procedure?')}
System Count: {get_safe('How many different electronic systems are typically used during this procedure?')}
Procedure Frequency: {get_safe('How many times is this procedure performed on average each month?')}
KEY STAKEHOLDERS FOR ANALYSIS: {get_safe('Who are the key stakeholders (individuals or departments) that would be positively impacted by this automation?  ')} (Use THIS value for stakeholder analysis)
"""

        # Use the singleton model instance instead of creating a new one each time
        model = get_model()
        
        # Generate content with the model
        response = model.generate_content(prompt)

        try:
            analysis_text = response.text.strip()
            # Remove potential markdown code block fences added by the model
            if analysis_text.startswith("```markdown"):
                analysis_text = analysis_text[len("```markdown"):].strip()
            if analysis_text.endswith("```"):
                analysis_text = analysis_text[:-len("```")].strip()
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
        app.recent_analysis = analysis_text
        
        # Cache the result for future requests
        analysis_cache[row_index] = result_data
        
        return jsonify(result_data)

    except KeyError as e:
        print(f"KeyError accessing data for row {row_index}: {e}")
        return jsonify({"error": f"Missing expected data column '{e}' in the uploaded CSV for the selected row."}), 400
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
    Endpoint to clear the chat history.
    """
    global df_global
    try:
        df_global = None
        return jsonify({"message": "Chat history cleared successfully."}), 200
    except Exception as e:
        print(f"Error clearing chat history: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to clear chat history: {e}"}), 500

@app.route('/analysis/clear', methods=['POST'])
@timing_decorator
def clear_analysis_cache():
    """
    Endpoint to clear the analysis cache.
    This allows users to free up memory and force fresh analyses.
    """
    global analysis_cache
    try:
        cache_size = len(analysis_cache)
        analysis_cache.clear()
        print(f"Cleared analysis cache containing {cache_size} items")
        return jsonify({"message": f"Analysis cache cleared successfully ({cache_size} items removed)."}), 200
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
        return jsonify({"error": f"Failed to send email: {e}"}), 500

if __name__ == '__main__':
    app.run(
        debug=app.config["FLASK_DEBUG"],
        host=app.config["FLASK_HOST"],
        port=5000  # Fixed port for OAuth compatibility
    )
