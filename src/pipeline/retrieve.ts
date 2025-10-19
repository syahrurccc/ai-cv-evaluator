import { queryChunks, Namespace } from '../rag/client';
import { RetrievedChunk } from '../rag/schema';

export type RetrieveNamespace = Namespace;

export const retrieveTopChunks = (
  namespace: RetrieveNamespace,
  query: string,
  topK = 3,
): RetrievedChunk[] => queryChunks(namespace, query, topK);
