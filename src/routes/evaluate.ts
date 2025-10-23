import { Router } from 'express';
import { z } from 'zod';

import { parsePdf } from '../pipeline/parsePdf';
import { evaluateCv } from '../pipeline/evalCv';
import { evaluateProject } from '../pipeline/evalProject';
import { retrieveTopChunks } from '../pipeline/retrieve';
import { synthesize } from '../pipeline/synthesize';
import { getFilePathById } from '../store/files';
import { createJob, updateJob } from '../store/jobs';

const router = Router();

const evaluateSchema = z.object({
  job_title: z.string().min(1, 'job_title is required'),
  cv_file_id: z.string().min(1, 'cv_file_id is required'),
  project_file_id: z.string().min(1, 'project_file_id is required'),
});

type EvaluatePayload = {
  job_title: string;
  cv_file_id: string;
  project_file_id: string;
};

type EvaluationResult = {
  cv_match_rate: number;
  cv_feedback: string;
  project_score: number;
  project_feedback: string;
  overall_summary: string;
};

const enqueueJob = (jobId: string, payload: EvaluatePayload): void => {
  setImmediate(async () => {
    updateJob(jobId, { status: 'processing' });

    try {
      const cvFilePath = getFilePathById(payload.cv_file_id);
      const projectFilePath = getFilePathById(payload.project_file_id);

      if (!cvFilePath || !projectFilePath) {
        throw new Error('One or more files could not be found for evaluation.');
      }

      const [cvDocument, projectDocument] = await Promise.all([
        parsePdf(cvFilePath),
        parsePdf(projectFilePath),
      ]);

      const [jobDescriptionChunks, cvRubricChunks] = await Promise.all([
        retrieveTopChunks('job_description', payload.job_title, 3),
        retrieveTopChunks('cv_rubric', payload.job_title, 3),
      ]);

      const jobDescriptionContext = [...jobDescriptionChunks, ...cvRubricChunks];

      const cvEvaluation = await evaluateCv({
        jobTitle: payload.job_title,
        cvText: cvDocument.text,
        context: jobDescriptionContext,
      });

      const [briefChunks, projectRubricChunks] = await Promise.all([
        retrieveTopChunks('case_study_brief', payload.job_title, 3),
        retrieveTopChunks('project_rubric', payload.job_title, 3),
      ]);

      const projectContext = [...briefChunks, ...projectRubricChunks];

      const projectEvaluation = await evaluateProject({
        projectText: projectDocument.text,
        context: projectContext,
      });

      const synthesis = await synthesize({
        jobTitle: payload.job_title,
        cv: cvEvaluation,
        project: projectEvaluation,
      });

      const result: EvaluationResult = {
        cv_match_rate: cvEvaluation.matchRate,
        cv_feedback: cvEvaluation.feedback,
        project_score: projectEvaluation.score,
        project_feedback: projectEvaluation.feedback,
        overall_summary: synthesis.summary
      };

      updateJob(jobId, {
        status: 'completed',
        result,
      });
    } catch (error) {
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};

router.post('/', (req: any, res: any) => {
  const validation = evaluateSchema.safeParse(req.body);

  if (!validation.success) {
    const issues = validation.error.issues.map((issue: any) => ({
      path: issue.path.join('.') || undefined,
      message: issue.message,
    }));

    return res.status(400).json({ errors: issues });
  }

  const job = createJob();

  enqueueJob(job.id, validation.data);

  return res.status(202).json({ id: job.id, status: job.status });
});

export default router;
