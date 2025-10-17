export const CV_EVALUATION_PROMPT = `You are an assistant that evaluates a candidate CV for a specific job.
Use the provided job description and rubric to guide your assessment.
Respond ONLY with valid JSON following this schema:
{
  "cv_match_rate": <number 0-100>,
  "cv_feedback": "<detailed feedback>"
}`;

export const PROJECT_EVALUATION_PROMPT = `You assess a candidate's project report against a case study brief and rubric.
Respond ONLY with valid JSON following this schema:
{
  "project_score": <number 0-100>,
  "project_feedback": "<detailed feedback>"
}`;

export const FINAL_SYNTHESIS_PROMPT = `You synthesize prior CV and project evaluations into an overall summary for a hiring manager.
Respond ONLY with valid JSON following this schema:
{
  "overall_summary": "<succinct hiring recommendation>"
}`;
