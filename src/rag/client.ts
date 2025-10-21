import { ChromaClient } from 'chromadb';

import { generateEmbeddings } from './embeddings';
import { DocChunk, RetrievedChunk, Namespace } from './schema';

type ChunkInput = Omit<DocChunk, 'namespace'> & { namespace?: Namespace };

const DEFAULT_COLLECTION = process.env.CHROMA_COLLECTION ?? 'ground-truth';
const DEFAULT_CHROMA_URL = process.env.CHROMA_URL ?? 'http://localhost:8000';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeMetadata = (namespace: Namespace, metadata: unknown): Record<string, unknown> => {
  const base: Record<string, unknown> = { namespace };

  if (isPlainObject(metadata)) {
    Object.entries(metadata).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        base[key] = value;
      }
    });
  }

  return base;
};

const normalizeScore = (distance: number | undefined): number => {
  if (typeof distance !== 'number' || Number.isNaN(distance)) {
    return 0;
  }

  return 1 / (1 + Math.max(distance, 0));
};

class ChromaRagClient {
  private readonly chromaUrl: string = DEFAULT_CHROMA_URL;

  private readonly collectionName: string = DEFAULT_COLLECTION;

  private readonly client: ChromaClient;

  private collectionPromise: Promise<any> | null = null;

  constructor() {
    this.client = new ChromaClient({ path: this.chromaUrl });
  }

  private async getCollection(): Promise<any> {
    if (!this.collectionPromise) {
      this.collectionPromise = this.client.getOrCreateCollection({
        name: this.collectionName,
      });
    }

    return this.collectionPromise;
  }

  async upsert(namespace: Namespace, chunkInputs: ChunkInput[]): Promise<void> {
    if (!chunkInputs.length) {
      return;
    }

    const collection = await this.getCollection();

    const ids = chunkInputs.map((chunk, index) => chunk.id ?? `${namespace}_${Date.now()}_${index}`);
    const documents = chunkInputs.map((chunk) => chunk.content ?? '');
    const metadatas = chunkInputs.map((chunk) => normalizeMetadata(namespace, chunk.metadata));

    const embeddings = await generateEmbeddings(documents);

    await collection.upsert({
      ids,
      documents,
      metadatas,
      embeddings,
    });
  }

  async query(namespace: Namespace, query: string, topK = 3): Promise<RetrievedChunk[]> {
    if (!query.trim()) {
      return [];
    }

    const collection = await this.getCollection();
    const result = await collection.query({
      queryTexts: [query],
      nResults: topK,
      where: { namespace },
    });

    const documents = (result?.documents?.[0] ?? []) as string[];
    const ids = (result?.ids?.[0] ?? []) as string[];
    const metadatas = (result?.metadatas?.[0] ?? []) as Record<string, unknown>[];
    const distances = (result?.distances?.[0] ?? []) as number[];

    return ids.map<RetrievedChunk>((id, index) => ({
      id,
      namespace: (metadatas[index]?.namespace as Namespace) ?? namespace,
      content: documents[index] ?? '',
      metadata: metadatas[index],
      score: normalizeScore(distances[index]),
    }));
  }
}

const ragClient = new ChromaRagClient();

export const upsertChunks = (namespace: Namespace, chunkInputs: ChunkInput[]): Promise<void> =>
  ragClient.upsert(namespace, chunkInputs);

export const queryChunks = (
  namespace: Namespace,
  query: string,
  topK?: number,
): Promise<RetrievedChunk[]> => ragClient.query(namespace, query, topK);

export type { Namespace };
