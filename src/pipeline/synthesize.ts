import { z } from 'zod';

import { llmClient } from '../llm/client';
import { CvEvaluationResult } from './evalCv';
import { ProjectEvaluationResult } from './evalProject';

const synthesisSchema = z.object({
  overall_summary: z.string(),
});

type SynthesizeArgs = {
  jobTitle: string;
  cv: CvEvaluationResult;
  project: ProjectEvaluationResult;
};

export type SynthesisResult = {
  summary: string;
};

export const synthesize = async ({
  jobTitle,
  cv,
  project,
}: SynthesizeArgs): Promise<SynthesisResult> => {
  const response = await llmClient.synthesize({
    jobTitle,
    cvMatchRate: cv.matchRate,
    cvFeedback: cv.feedback,
    projectScore: project.score,
    projectFeedback: project.feedback,
  });

  const parsed = synthesisSchema.parse(response);

  return {
    summary: parsed.overall_summary,
  };
};
