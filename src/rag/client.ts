import { DocChunk, RetrievedChunk } from './schema';

export type Namespace =
  | 'job_description'
  | 'case_study_brief'
  | 'cv_rubric'
  | 'project_rubric';

type ChunkInput = Omit<DocChunk, 'id' | 'namespace'> & { id?: string };

type SeedData = Record<Namespace, ChunkInput[]>;

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const computeScore = (queryTokens: string[], content: string): number => {
  if (!content.trim()) {
    return 0;
  }

  const contentTokens = tokenize(content);
  const tokenSet = new Set(contentTokens);

  let score = 0;
  queryTokens.forEach((token) => {
    if (tokenSet.has(token)) {
      score += 1;
    }
  });

  return score;
};

class InMemoryRagClient {
  private chunksByNamespace = new Map<Namespace, DocChunk[]>();

  constructor(seed?: SeedData) {
    if (seed) {
      Object.entries(seed).forEach(([namespace, chunks]) => {
        this.upsert(namespace as Namespace, chunks);
      });
    }
  }

  upsert(namespace: Namespace, chunkInputs: ChunkInput[]): void {
    const existing = this.chunksByNamespace.get(namespace) ?? [];
    const nextChunks = [...existing];

    chunkInputs.forEach((input, index) => {
      const chunk: DocChunk = {
        id: input.id ?? `${namespace}_${existing.length + index + 1}`,
        namespace,
        content: input.content,
        metadata: input.metadata,
      };

      const foundIndex = nextChunks.findIndex((item) => item.id === chunk.id);
      if (foundIndex >= 0) {
        nextChunks[foundIndex] = chunk;
      } else {
        nextChunks.push(chunk);
      }
    });

    this.chunksByNamespace.set(namespace, nextChunks);
  }

  query(namespace: Namespace, query: string, topK = 3): RetrievedChunk[] {
    const chunks = this.chunksByNamespace.get(namespace) ?? [];
    const tokens = tokenize(query);

    const scored = chunks
      .map<RetrievedChunk>((chunk) => ({
        ...chunk,
        score: tokens.length ? computeScore(tokens, chunk.content) : 0,
      }))
      .filter((chunk) => chunk.score > 0 || tokens.length === 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }
}

const seedData: SeedData = {
  job_description: [
    {
      id: 'jd_1',
      content:
        'We are seeking an AI engineer to build CV evaluation pipelines and collaborate with product teams.',
    },
    {
      id: 'jd_2',
      content:
        'Responsibilities include designing retrieval augmented generation workflows and delivering hiring insights.',
    },
  ],
  case_study_brief: [
    {
      id: 'brief_1',
      content:
        'Analyze the provided project report to determine solution quality, clarity of communication, and technical depth.',
    },
    {
      id: 'brief_2',
      content:
        'Emphasize candidate ability to reason about trade-offs and demonstrate impact in their project delivery.',
    },
  ],
  cv_rubric: [
    {
      id: 'cv_rubric_1',
      content:
        'Score the CV on alignment with job requirements, relevant experience, and communication clarity on achievements.',
    },
    {
      id: 'cv_rubric_2',
      content:
        'Highlight concrete metrics, leadership signals, and collaboration with cross-functional stakeholders.',
    },
  ],
  project_rubric: [
    {
      id: 'project_rubric_1',
      content:
        'Evaluate the project on problem understanding, solution design, experimentation rigor, and measurable outcomes.',
    },
    {
      id: 'project_rubric_2',
      content:
        'Call out strengths, gaps, and next steps the candidate should take to improve future case studies.',
    },
  ],
};

export const ragClient = new InMemoryRagClient(seedData);

export const upsertChunks = (namespace: Namespace, chunkInputs: ChunkInput[]): void => {
  ragClient.upsert(namespace, chunkInputs);
};

export const queryChunks = (
  namespace: Namespace,
  query: string,
  topK?: number,
): RetrievedChunk[] => ragClient.query(namespace, query, topK);
