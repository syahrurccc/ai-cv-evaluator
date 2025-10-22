import OpenAI from 'openai';

import { exponentialBackoff } from '../util/retry';
import { CV_EVALUATION_PROMPT, FINAL_SYNTHESIS_PROMPT, PROJECT_EVALUATION_PROMPT } from './prompts';

type CvEvaluationPayload = {
  jobTitle: string;
  cvText: string;
  context: string[];
};

type ProjectEvaluationPayload = {
  projectText: string;
  context: string[];
};

type SynthesisPayload = {
  jobTitle: string;
  cvMatchRate: number;
  cvFeedback: string;
  projectScore: number;
  projectFeedback: string;
};

type CvEvaluationResponse = {
  cv_match_rate: number;
  cv_feedback: string;
};

type ProjectEvaluationResponse = {
  project_score: number;
  project_feedback: string;
};

type SynthesisResponse = {
  overall_summary: string;
};

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = 'mistralai/mistral-small-3.2-24b-instruct:free';

const buildUserInput = (input: Record<string, unknown>): string => JSON.stringify(input, null, 2);

class OpenRouterLlmClient {
  private client: any = null;

  private getClient(): any {
    if (this.client) {
      return this.client;
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('LLM API key not configured. Set OPENAI_API_KEY to your OpenRouter token.');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
    });

    return this.client;
  }

  private async completeStructured<T>(prompt: string, input: Record<string, unknown>): Promise<T> {
    const client = this.getClient();
    const model = OPENROUTER_MODEL;

    const response = await exponentialBackoff(async (attempt) => {
      if (attempt > 1) {
        console.warn(`Retrying LLM call (attempt ${attempt}).`);
      }

      return client.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: buildUserInput(input) },
        ],
      });
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('LLM response did not contain any content.');
    }

    try {
      return JSON.parse(content) as T;
    } catch (error) {
      throw new Error(`Failed to parse LLM JSON response: ${(error as Error).message}`);
    }
  }

  async evaluateCv(payload: CvEvaluationPayload): Promise<CvEvaluationResponse> {
    return this.completeStructured<CvEvaluationResponse>(CV_EVALUATION_PROMPT, {
      jobTitle: payload.jobTitle,
      cvText: payload.cvText,
      context: payload.context,
    });
  }

  async evaluateProject(payload: ProjectEvaluationPayload): Promise<ProjectEvaluationResponse> {
    return this.completeStructured<ProjectEvaluationResponse>(PROJECT_EVALUATION_PROMPT, {
      projectText: payload.projectText,
      context: payload.context,
    });
  }

  async synthesize(payload: SynthesisPayload): Promise<SynthesisResponse> {
    return this.completeStructured<SynthesisResponse>(FINAL_SYNTHESIS_PROMPT, {
      jobTitle: payload.jobTitle,
      cvMatchRate: payload.cvMatchRate,
      cvFeedback: payload.cvFeedback,
      projectScore: payload.projectScore,
      projectFeedback: payload.projectFeedback,
    });
  }
}

export const llmClient = new OpenRouterLlmClient();
