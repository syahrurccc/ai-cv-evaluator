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

class MockLlmClient {
  private hasRealProvider = Boolean(process.env.LLM_API_KEY);

  private async completeStructured<T>(
    _prompt: string,
    _input: Record<string, unknown>,
    mockResponse: T,
  ): Promise<T> {
    if (!this.hasRealProvider) {
      return mockResponse;
    }

    // Placeholder for real provider integration in Phase 2.
    return mockResponse;
  }

  async evaluateCv(payload: CvEvaluationPayload): Promise<CvEvaluationResponse> {
    return this.completeStructured<CvEvaluationResponse>(
      CV_EVALUATION_PROMPT,
      {
        jobTitle: payload.jobTitle,
        cvText: payload.cvText,
        context: payload.context,
      },
      {
        cv_match_rate: 72,
        cv_feedback:
          'The candidate demonstrates relevant experience in building evaluation systems but could highlight measurable impact more clearly.',
      },
    );
  }

  async evaluateProject(payload: ProjectEvaluationPayload): Promise<ProjectEvaluationResponse> {
    return this.completeStructured<ProjectEvaluationResponse>(
      PROJECT_EVALUATION_PROMPT,
      {
        projectText: payload.projectText,
        context: payload.context,
      },
      {
        project_score: 78,
        project_feedback:
          'The project outlines a thoughtful approach with solid experimentation but should expand on business outcomes and stakeholder alignment.',
      },
    );
  }

  async synthesize(payload: SynthesisPayload): Promise<SynthesisResponse> {
    return this.completeStructured<SynthesisResponse>(
      FINAL_SYNTHESIS_PROMPT,
      {
        jobTitle: payload.jobTitle,
        cvMatchRate: payload.cvMatchRate,
        cvFeedback: payload.cvFeedback,
        projectScore: payload.projectScore,
        projectFeedback: payload.projectFeedback,
      },
      {
        overall_summary:
          'Overall, the candidate shows promise for the role with relevant skills and a strong project approach; encourage them to emphasize quantifiable results in future discussions.',
      },
    );
  }
}

export const llmClient = new MockLlmClient();
