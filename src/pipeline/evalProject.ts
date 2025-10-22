import { z } from 'zod';

import { llmClient } from '../llm/client';
import { RetrievedChunk } from '../rag/schema';

const projectEvaluationSchema = z.object({
  project_score: z.number(),
  project_feedback: z.string(),
});

type EvaluateProjectArgs = {
  projectText: string;
  context: RetrievedChunk[];
};

export type ProjectEvaluationResult = {
  score: number;
  feedback: string;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const toTwoDecimals = (value: number): number =>
  Math.round(value * 100) / 100;

export const evaluateProject = async ({
  projectText,
  context,
}: EvaluateProjectArgs): Promise<ProjectEvaluationResult> => {
  const response = await llmClient.evaluateProject({
    projectText,
    context: context.map((chunk) => chunk.content),
  });

  const parsed = projectEvaluationSchema.parse(response);
  const score = toTwoDecimals(
    clamp(Number.isFinite(parsed.project_score) ? parsed.project_score : 0, 0, 1),
  );

  return {
    score,
    feedback: parsed.project_feedback,
  };
};
