import { exponentialBackoff } from '../util/retry';

type EmbeddingBatchOptions = {
  batchSize?: number;
};

type RequestError = Error & { status?: number; detail?: string };

const DEFAULT_MAX_ATTEMPTS = Math.max(1, Number.parseInt(process.env.CHROMA_EMBED_MAX_ATTEMPTS ?? '5', 10) || 5);
const DEFAULT_BATCH_SIZE = Math.max(1, Number.parseInt(process.env.CHROMA_BATCH_SIZE ?? '64', 10) || 64);
const DEFAULT_MODEL = 'nomic-embed-text';
const DEFAULT_BASE_URL = process.env.NOMIC_EMBED_URL ?? 'http://localhost:11434';

const buildEndpoint = (baseUrl: string): string => {
  try {
    const url = new URL(baseUrl);
    url.pathname = '/api/embeddings';
    url.search = '';
    return url.toString();
  } catch (error) {
    throw new Error(`Invalid embedding service URL "${baseUrl}": ${(error as Error).message}`);
  }
};

const getStatus = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') {
      return status;
    }
  }
  return undefined;
};

const getDetail = (error: unknown): string | undefined => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'detail' in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === 'string') {
      return detail;
    }
  }

  return undefined;
};

class EmbeddingGenerator {
  private readonly model: string = DEFAULT_MODEL;

  private readonly batchSize: number;

  private readonly maxAttempts: number;

  private readonly endpoint: string;

  constructor({ batchSize }: EmbeddingBatchOptions = {}) {
    this.batchSize = Math.max(1, batchSize ?? DEFAULT_BATCH_SIZE);
    this.maxAttempts = DEFAULT_MAX_ATTEMPTS;
    this.endpoint = buildEndpoint(DEFAULT_BASE_URL);
  }

  private chunkTexts(texts: string[]): string[][] {
    const batches: string[][] = [];

    for (let index = 0; index < texts.length; index += this.batchSize) {
      batches.push(texts.slice(index, index + this.batchSize));
    }

    return batches;
  }

  private shouldRetry(error: unknown): boolean {
    const status = getStatus(error);

    if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
      return false;
    }

    return true;
  }

  private logRetry(error: unknown, attempt: number, delay: number): void {
    const status = getStatus(error);
    const detail = getDetail(error) ?? 'Unknown error';
    const prefix = typeof status === 'number' ? `status ${status} — ` : '';

    console.warn(`Embedding request attempt ${attempt} failed (${prefix}${detail}). Retrying in ${delay}ms.`);
  }

  private buildEmbeddingError(error: unknown): Error {
    const status = getStatus(error);
    const detail = getDetail(error) ?? 'Unknown error';
    const message = typeof status === 'number'
      ? `Embedding request failed (status ${status}): ${detail}`
      : `Embedding request failed: ${detail}`;
    const embeddingError = new Error(message);

    (embeddingError as Error & { cause?: unknown }).cause = error instanceof Error ? error : undefined;

    return embeddingError;
  }

  private normalizeEmbeddingVector(values: unknown): number[] {
    if (!Array.isArray(values)) {
      throw new Error('Embedding response did not include an array of numbers.');
    }

    return values.map((value, index) => {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(numeric)) {
        throw new Error(`Embedding value at index ${index} is not a valid number.`);
      }
      return numeric;
    });
  }

  private async requestBatch(batch: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of batch) {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const detailText = await response.text();
        const error = new Error(detailText || response.statusText) as RequestError;
        error.status = response.status;
        error.detail = detailText || response.statusText;
        throw error;
      }

      let data: unknown;

      try {
        data = await response.json();
      } catch (error) {
        throw new Error(`Failed to parse embedding response JSON: ${(error as Error).message}`);
      }

      const embedding = (data as { embedding?: unknown })?.embedding;

      embeddings.push(this.normalizeEmbeddingVector(embedding));
    }

    return embeddings;
  }

  async generate(texts: string[]): Promise<number[][]> {
    if (!texts.length) {
      return [];
    }
    const batches = this.chunkTexts(texts);
    const embeddings: number[][] = [];

    for (const batch of batches) {
      let batchEmbeddings: number[][];

      try {
        batchEmbeddings = await exponentialBackoff(
          () => this.requestBatch(batch),
          {
            maxAttempts: this.maxAttempts,
            onRetry: (error, attempt, delay) => this.logRetry(error, attempt, delay),
            shouldRetry: (error) => this.shouldRetry(error),
          },
        );
      } catch (error) {
        throw this.buildEmbeddingError(error);
      }

      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }
}

const generator = new EmbeddingGenerator();

export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => generator.generate(texts);
