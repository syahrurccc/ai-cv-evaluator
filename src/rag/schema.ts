export type Namespace =
  | 'job_description'
  | 'case_study_brief'
  | 'cv_rubric'
  | 'project_rubric';

export interface DocChunk {
  id: string;
  namespace: Namespace;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RetrievedChunk extends DocChunk {
  score: number;
}
