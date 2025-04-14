import os
import pickle
from pathlib import Path
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import base64
from typing import Optional
from datetime import datetime

# Constants
SCOPES = ['https://www.googleapis.com/auth/gmail.send']
TOKEN_FILE = 'credentials/token.pickle'
CREDENTIALS_FILE = 'credentials/client_secret.json'

def get_gmail_service():
    """Authenticate and return Gmail service instance."""
    creds = None
    
    # Load existing token if available
    if Path(TOKEN_FILE).exists():
        with open(TOKEN_FILE, 'rb') as token:
            creds = pickle.load(token)

    # If no valid credentials, authenticate
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES,
                redirect_uri='http://localhost:5000')
            creds = flow.run_local_server(
                port=5000,
                authorization_prompt_message='Please visit this URL to authorize the application: {url}',
                success_message='The authentication flow has completed. You may close this window.',
                open_browser=True)
        
        # Save the credentials for next run
        with open(TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)

    return build('gmail', 'v1', credentials=creds)

def send_email(recipient: str, subject: str, body: str, pdf: Optional[str] = None) -> Optional[str]:
    """Send an email using Gmail API with optional PDF attachment.
    
    Args:
        recipient: Email address of recipient
        subject: Email subject
        body: Email body content
        pdf: Optional base64 encoded PDF content
        
    Returns:
        Message ID if successful, None otherwise
    """
    try:
        service = get_gmail_service()
        
        # Create message container
        message = MIMEMultipart()
        message['to'] = recipient
        message['subject'] = subject
        
        # Add body text
        message.attach(MIMEText(body))
        
        # Add PDF attachment if provided
        if pdf:
            pdf_data = base64.b64decode(pdf)
            part = MIMEApplication(pdf_data, Name='analysis_report.pdf')
            part['Content-Disposition'] = f'attachment; filename="Analysis_Report_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'
            message.attach(part)
        
        # Encode and send
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        result = service.users().messages().send(
            userId='me',
            body={'raw': raw}
        ).execute()
        
        return result.get('id')
        
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return None
