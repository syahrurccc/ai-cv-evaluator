import { Router } from 'express';
import { z } from 'zod';

import { createJob, updateJob } from '../store/jobs';

const router = Router();

const evaluateSchema = z.object({
  job_title: z.string().min(1, 'job_title is required'),
  cv_file_id: z.string().min(1, 'cv_file_id is required'),
  project_file_id: z.string().min(1, 'project_file_id is required'),
});

type EvaluatePayload = z.infer<typeof evaluateSchema>;

const enqueueJob = (jobId: string, payload: EvaluatePayload): void => {
  setImmediate(() => {
    updateJob(jobId, { status: 'processing' });

    try {
      const simulatedResult = {
        message: 'Evaluation completed',
        jobTitle: payload.job_title,
        cvFileId: payload.cv_file_id,
        projectFileId: payload.project_file_id,
      };

      updateJob(jobId, {
        status: 'completed',
        result: simulatedResult,
      });
    } catch (error) {
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};

router.post('/', (req, res) => {
  const validation = evaluateSchema.safeParse(req.body);

  if (!validation.success) {
    const issues = validation.error.issues.map((issue) => ({
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
