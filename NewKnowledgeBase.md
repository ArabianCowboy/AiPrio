# New Knowledge Base

## Key Insights
1. The LLM prompt template in app.py requires exact column name matching for proper field recognition
2. Stakeholder analysis is a critical component of the prioritization evaluation
3. The system uses a singleton pattern for the AI model to improve performance
4. Prompt modifications require careful attention to field naming consistency
5. CSV column headers must exactly match the code's expected format
6. Special handling is needed for "N/A" values in stakeholder fields
7. Empty strings are better than "N/A" for missing stakeholder data
8. LLM output formatting requires explicit instructions to maintain table structure (e.g., keeping all content within cells).
9. Providing example formats in prompts helps ensure consistent output structure.
10. Stakeholder analysis must be contained within table cells to prevent display issues.
11. LLMs can confuse similar fields (like Directorate vs. Stakeholders) without explicit differentiation.
12. Verification steps in prompts help prevent common field confusion errors.
13. Visual emphasis (capitalization, notes) helps highlight critical fields in prompts.
14. Integrating concluding remarks as a final table row *can* enforce consistent formatting, but may fail if the prompt is too complex. Reverting to a separate conclusion section might be necessary.
15. Explicitly instructing the LLM on how to handle empty input fields (e.g., for stakeholders) prevents malformed output.
16. Reinforcing overall output format rules (e.g., "entire output must be valid Markdown") can improve compliance.
17. Extremely forceful formatting constraints (e.g., "OUTPUT ONLY THE MARKDOWN TABLE") can backfire and cause the LLM to ignore *all* formatting. Simpler, positive instructions are often better.
18. Simplifying complex prompt sections (like stakeholder justification) can improve LLM adherence.
19. AI models might wrap their Markdown output in code fences (e.g., ```markdown ... ```), which prevents frontend libraries like `marked.js` from rendering it as HTML. Stripping these fences in the backend (`app.py`) before sending the response is necessary.
