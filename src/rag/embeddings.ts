import OpenAI from 'openai';

import { exponentialBackoff } from '../util/retry';

type EmbeddingBatchOptions = {
  batchSize?: number;
};

type ErrorInfo = {
  status?: number;
  code?: string;
  message?: string;
};

const DEFAULT_MAX_ATTEMPTS = Math.max(1, Number.parseInt(process.env.CHROMA_EMBED_MAX_ATTEMPTS ?? '5', 10) || 5);
const DEFAULT_MODEL = process.env.CHROMA_EMBED_MODEL ?? 'text-embedding-3-large';
const DEFAULT_BATCH_SIZE = Math.max(1, Number.parseInt(process.env.CHROMA_BATCH_SIZE ?? '64', 10) || 64);

const extractErrorInfo = (error: unknown): ErrorInfo => {
  const info: ErrorInfo = {};

  if (!error) {
    return info;
  }

  if (error instanceof Error) {
    info.message = error.message;
  }

  if (typeof error !== 'object') {
    return info;
  }

  const maybeError = error as {
    status?: number;
    code?: string;
    message?: string;
    response?: { status?: number; data?: { error?: unknown } };
    error?: unknown;
  };

  if (typeof maybeError.status === 'number') {
    info.status = maybeError.status;
  }

  if (typeof maybeError.code === 'string') {
    info.code = maybeError.code;
  }

  if (typeof maybeError.message === 'string') {
    info.message = maybeError.message;
  }

  const response = maybeError.response;
  if (response) {
    if (typeof response.status === 'number' && typeof info.status === 'undefined') {
      info.status = response.status;
    }

    const responseError = response.data?.error;
    if (responseError && typeof responseError === 'object') {
      const nested = responseError as { status?: number; code?: string; type?: string; message?: string };
      if (typeof nested.status === 'number' && typeof info.status === 'undefined') {
        info.status = nested.status;
      }
      if (typeof nested.code === 'string' && !info.code) {
        info.code = nested.code;
      } else if (typeof nested.type === 'string' && !info.code) {
        info.code = nested.type;
      }
      if (typeof nested.message === 'string') {
        info.message = nested.message;
      }
    }
  }

  const nestedError = maybeError.error;
  if (nestedError && typeof nestedError === 'object') {
    const nestedInfo = extractErrorInfo(nestedError);
    if (typeof info.status === 'undefined' && typeof nestedInfo.status !== 'undefined') {
      info.status = nestedInfo.status;
    }
    if (!info.code && nestedInfo.code) {
      info.code = nestedInfo.code;
    }
    if (nestedInfo.message) {
      info.message = nestedInfo.message;
    }
  }

  return info;
};

const isQuotaError = (info: ErrorInfo): boolean => {
  const message = info.message?.toLowerCase() ?? '';
  return info.code === 'insufficient_quota' || message.includes('insufficient quota') || message.includes('exceeded your current quota');
};

class EmbeddingGenerator {
  private client: any = null;

  private readonly model: string;

  private readonly batchSize: number;

  private readonly maxAttempts: number;

  constructor({ batchSize }: EmbeddingBatchOptions = {}) {
    this.model = DEFAULT_MODEL;
    this.batchSize = Math.max(1, batchSize ?? DEFAULT_BATCH_SIZE);
    this.maxAttempts = DEFAULT_MAX_ATTEMPTS;
  }

  private getClient(): any {
    if (this.client) {
      return this.client;
    }

    const apiKey = process.env.CHROMA_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY;

    if (!apiKey) {
      throw new Error(
        'No API key configured for embeddings. Set CHROMA_API_KEY, OPENAI_API_KEY, or LLM_API_KEY before running ingestion.',
      );
    }

    this.client = new OpenAI({
      apiKey,
      organization: process.env.OPENAI_ORG ?? process.env.CHROMA_OPENAI_ORG,
      baseURL: process.env.OPENAI_BASE_URL ?? process.env.CHROMA_OPENAI_BASE_URL,
    });

    return this.client;
  }

  private chunkTexts(texts: string[]): string[][] {
    const batches: string[][] = [];

    for (let index = 0; index < texts.length; index += this.batchSize) {
      batches.push(texts.slice(index, index + this.batchSize));
    }

    return batches;
  }

  private shouldRetry(error: unknown): boolean {
    const info = extractErrorInfo(error);

    if (info.status && info.status >= 400 && info.status < 500) {
      if (info.status === 429) {
        return !isQuotaError(info);
      }
      return false;
    }

    return true;
  }

  private logRetry(error: unknown, attempt: number, delay: number): void {
    const info = extractErrorInfo(error);
    const parts: string[] = [];

    if (info.status) {
      parts.push(`status ${info.status}`);
    }

    if (info.code) {
      parts.push(info.code);
    }

    const detail = info.message ?? (error instanceof Error ? error.message : undefined) ?? 'Unknown error';
    const reason = parts.length ? `${parts.join(' ')} — ${detail}` : detail;

    console.warn(`Embedding request attempt ${attempt} failed (${reason}). Retrying in ${delay}ms.`);
  }

  private buildEmbeddingError(error: unknown): Error {
    const info = extractErrorInfo(error);
    const segments: string[] = ['Embedding request failed'];

    if (info.status) {
      segments.push(`(status ${info.status})`);
    }

    if (info.code) {
      segments.push(`[${info.code}]`);
    }

    const detail = info.message ?? (error instanceof Error ? error.message : undefined) ?? 'Unknown error';
    const message = `${segments.join(' ')}: ${detail}`;
    const embeddingError = new Error(message);

    (embeddingError as Error & { cause?: unknown }).cause = error instanceof Error ? error : undefined;

    return embeddingError;
  }

  async generate(texts: string[]): Promise<number[][]> {
    if (!texts.length) {
      return [];
    }

    const client = this.getClient();
    const batches = this.chunkTexts(texts);
    const embeddings: number[][] = [];

    for (const batch of batches) {
      let response: any;

      try {
        response = await exponentialBackoff(
          () =>
            client.embeddings.create({
              model: this.model,
              input: batch,
            }),
          {
            maxAttempts: this.maxAttempts,
            onRetry: (error, attempt, delay) => this.logRetry(error, attempt, delay),
            shouldRetry: (error) => this.shouldRetry(error),
          },
        );
      } catch (error) {
        throw this.buildEmbeddingError(error);
      }

      response.data.forEach((item: any) => {
        embeddings.push(item.embedding as number[]);
      });
    }

    return embeddings;
  }
}

const generator = new EmbeddingGenerator();

export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => generator.generate(texts);
