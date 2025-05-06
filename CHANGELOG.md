# Changelog

## [2025-04-17]
- Simplified stakeholder justification prompt instructions
- Reverted Conclusion to appear after the table under `## Conclusion` heading
- Removed forceful "OUTPUT ONLY TABLE" constraints to restore Markdown formatting
- Added explicit handling for empty stakeholder input in the prompt
- Reinforced instructions to use the correct stakeholder field from Request Details
- Re-emphasized Markdown formatting for the entire LLM output
- Fixed confusion between Directorate and Key Stakeholders fields
- Added explicit instructions to use ONLY the Key Stakeholders field for stakeholder analysis
- Added verification step to prevent using Directorate as stakeholder
- Made Key Stakeholders field more prominent in Request Details section
- Fixed table formatting in LLM output to prevent content appearing outside the table
- Added explicit instructions to keep all stakeholder analysis inside table cells
- Improved stakeholder analysis format with clear examples
- Enhanced table cell formatting with specific templates
- Fixed Markdown table rendering issue by stripping ```markdown code fences from the AI response in the backend (`app.py`).

## [2025-04-16]
- Fixed LLM prompt to properly consider stakeholder information
- Updated prompt template to explicitly reference "Who are the key stakeholders..." column
- Improved stakeholder impact analysis in generated reports
- Enhanced documentation for stakeholder field handling
- Added special handling for "N/A" values in stakeholder field
