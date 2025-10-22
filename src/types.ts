export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface UploadResponse {
    files: { id: string; name: string }[];
}

export interface StartEvalRequest {
    job_title: string;
    cv_file_id: string;
    project_file_id: string;
}

export interface EvalQueued {
    id: string;
    status: Extract<JobStatus, "queued">;
}

export interface ProcessingStatus {
    id: string;
    status: Extract<JobStatus, "queued" | "processing">;
    }

export interface EvalResult {
    cv_match_rate: number; // 0..1
    cv_feedback: string;
    project_score: number; // 1..5
    project_feedback: string;
    overall_summary: string;
}

export interface CompletedStatus {
    id: string;
    status: Extract<JobStatus, "completed">;
    result: EvalResult;
}
