import OpenAI from 'openai';

import { exponentialBackoff } from '../util/retry';

type EmbeddingBatchOptions = {
  batchSize?: number;
};

const DEFAULT_MODEL = process.env.CHROMA_EMBED_MODEL ?? 'text-embedding-3-large';
const DEFAULT_BATCH_SIZE = Math.max(1, Number.parseInt(process.env.CHROMA_BATCH_SIZE ?? '64', 10) || 64);

class EmbeddingGenerator {
  private client: any = null;

  private readonly model: string;

  private readonly batchSize: number;

  constructor({ batchSize }: EmbeddingBatchOptions = {}) {
    this.model = DEFAULT_MODEL;
    this.batchSize = Math.max(1, batchSize ?? DEFAULT_BATCH_SIZE);
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

  async generate(texts: string[]): Promise<number[][]> {
    if (!texts.length) {
      return [];
    }

    const client = this.getClient();
    const batches = this.chunkTexts(texts);
    const embeddings: number[][] = [];

    for (const batch of batches) {
      const response: any = await exponentialBackoff((attempt) => {
        if (attempt > 1) {
          console.warn(`Retrying embedding request (attempt ${attempt}).`);
        }

        return client.embeddings.create({
          model: this.model,
          input: batch,
        });
      });

      response.data.forEach((item: any) => {
        embeddings.push(item.embedding as number[]);
      });
    }

    return embeddings;
  }
}

const generator = new EmbeddingGenerator();

export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => generator.generate(texts);
