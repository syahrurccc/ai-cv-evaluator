export interface DocChunk {
  id: string;
  namespace: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RetrievedChunk extends DocChunk {
  score: number;
}
