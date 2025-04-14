from gmail_service import get_gmail_service

def test_authentication():
    try:
        service = get_gmail_service()
        print("✅ Authentication successful!")
        print("Service created:", type(service))
        return True
    except Exception as e:
        print("❌ Authentication failed:")
        print(str(e))
        return False

if __name__ == "__main__":
    test_authentication()
