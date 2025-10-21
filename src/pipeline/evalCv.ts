import { z } from 'zod';

import { llmClient } from '../llm/client';
import { RetrievedChunk } from '../rag/schema';

const cvEvaluationSchema = z.object({
  cv_match_rate: z.number(),
  cv_feedback: z.string(),
});

type EvaluateCvArgs = {
  jobTitle: string;
  cvText: string;
  context: RetrievedChunk[];
};

export type CvEvaluationResult = {
  matchRate: number;
  feedback: string;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const evaluateCv = async ({
  jobTitle,
  cvText,
  context,
}: EvaluateCvArgs): Promise<CvEvaluationResult> => {
  const response = await llmClient.evaluateCv({
    jobTitle,
    cvText,
    context: context.map((chunk) => chunk.content),
  });

  const parsed = cvEvaluationSchema.parse(response);
  const matchRate = clamp(Number.isFinite(parsed.cv_match_rate) ? parsed.cv_match_rate : 0, 0, 100);

  return {
    matchRate,
    feedback: parsed.cv_feedback,
  };
};
