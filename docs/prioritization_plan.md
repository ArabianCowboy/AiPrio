# Approved Prioritization Logic Enhancement Plan

## 1. Goal

The primary goal of this plan is to modify the AiPrio application to calculate a weighted "Overall Priority" score in the Python backend. This change is in response to senior management's feedback to give higher importance to resource-related factors.

The final score will be calculated using a transparent, percentage-based weighting system, ensuring the logic is both accurate and easy to maintain.

## 2. Approved Weights

The following percentage-based weights have been approved and will be implemented in the backend:

| Category | Final Weight |
| :--- | :--- |
| **Number of Employees** | **40%** |
| **Hours Spent each month** | **35%** |
| Strategic Alignment | 10% |
| Potential Impact | 5% |
| Number of Systems | 2.5% |
| Stakeholders Impacted | 2.5% |
| Urgency & Necessity | 2.5% |
| Risk & Challenges | 2.5% |
| **Total** | **100%** |

## 3. Implementation Steps

The implementation will follow the "Backend-Calculated Score" approach.

- **File to Modify:** `app.py`
- **Function to Modify:** `prioritize_single(row_index)`

### Detailed Steps:

1.  **Modify AI Prompt:** The prompt sent to the Google Generative AI model will be updated. The section instructing the AI to calculate the `**10. Overall Priority**` will be removed. The AI's responsibility will be limited to providing the qualitative analysis and a `Rating %` for the other nine categories.

2.  **Add Backend Parsing Logic:** New Python code will be added within the `prioritize_single` function. This code will be responsible for parsing the markdown table returned by the AI to programmatically extract the `Rating %` for each category. Regular expressions will be used to ensure robust parsing.

3.  **Define Weights in Code:** A Python dictionary containing the approved weights will be defined directly in `app.py`.

    ```python
    WEIGHTS = {
        "Number of Employees": 0.40,
        "Hours Spent each month": 0.35,
        "Strategic Alignment": 0.10,
        "Potential Impact": 0.05,
        "Number of Systems": 0.025,
        "Stakeholders Impacted": 0.025,
        "Urgency & Necessity": 0.025,
        "Risk & Challenges": 0.025,
    }
    ```

4.  **Calculate Final Score:** The backend will perform the final calculation by multiplying each category's extracted rating by its corresponding weight and summing the results.

5.  **Integrate and Display:** The final, backend-calculated score will be formatted and appended to the AI's analysis text before the result is cached and sent to the frontend. This ensures the user sees a complete report containing both the AI's qualitative reasoning and the precise, weighted final score.