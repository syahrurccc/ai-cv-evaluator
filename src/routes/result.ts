import { Router } from 'express';

import { getJob } from '../store/jobs';

const router = Router();

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const job = getJob(id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status === 'completed') {
    return res.json({ id: job.id, status: job.status, result: job.result });
  }

  if (job.status === 'failed') {
    return res.json({ id: job.id, status: job.status, error: job.error });
  }

  return res.json({ id: job.id, status: job.status });
});

export default router;
