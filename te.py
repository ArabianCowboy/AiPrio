import pandas as pd

# Adjust the file path as needed
csv_file_path = "RPA and AI Request Submission (responses) - RPA and AI Request Submission (responses).csv"

# Read the CSV file, using the default comma delimiter
df = pd.read_csv(csv_file_path)

# Extract and print the headers (column names)
print(df.columns.tolist())
