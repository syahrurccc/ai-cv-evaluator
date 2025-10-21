import { queryChunks, Namespace } from '../rag/client';
import { RetrievedChunk } from '../rag/schema';

export type RetrieveNamespace = Namespace;

export const retrieveTopChunks = async (
  namespace: RetrieveNamespace,
  query: string,
  topK = 3,
): Promise<RetrievedChunk[]> => queryChunks(namespace, query, topK);
