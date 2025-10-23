import fs from 'node:fs';
import path from 'node:path';
import pdfParse from 'pdf-parse';
import dotenv from 'dotenv';
import { OllamaEmbeddingFunction } from '@chroma-core/ollama';
import { ChromaClient } from 'chromadb';
import { DocChunk, Namespace } from '../src/rag/schema';

dotenv.config();

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MIN_CHUNK_SIZE = 200;

const DATA_DIR = path.resolve('.data');
const DOCS_DIR = path.resolve('docs');
const OUTPUT_PATH = path.join(DATA_DIR, 'ground-truth.jsonl');
const DEFAULT_COLLECTION = process.env.CHROMA_COLLECTION ?? 'ground-truth-ollama';
const DEFAULT_CHROMA_URL = process.env.CHROMA_URL ?? 'http://localhost:8000';
const DEFAULT_MODEL = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text';
const DEFAULT_BASE_URL = process.env.OLLAMA_EMBED_URL ?? 'http://localhost:11434';

type GroundTruthSource = Namespace;

type PdfParseResult = Awaited<ReturnType<typeof pdfParse>>;

const ensureDataDir = async (): Promise<void> => {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
};

const listPdfFiles = async (): Promise<string[]> => {
  const entries = await fs.promises.readdir(DOCS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map((entry) => path.join(DOCS_DIR, entry.name));
};

const inferSource = (filePath: string): GroundTruthSource => {
  const name = path.parse(filePath).name.toLowerCase();

  if (name.includes('job')) {
    return 'job_description';
  }

  if (name.includes('brief')) {
    return 'case_study_brief';
  }

  if (name.includes('project')) {
    return 'project_rubric';
  }

  if (name.includes('cv')) {
    return 'cv_rubric';
  }

  throw new Error(
    `Unable to infer source namespace for ${filePath}. Expected filename to include job, brief, project, or cv.`,
  );
};

const tokenize = (text: string): string[] =>
  text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

const detokenize = (tokens: string[]): string => tokens.join(' ');

const createChunkId = (source: GroundTruthSource, baseId: string, index: number): string =>
  `${source}_${baseId}_${index + 1}`;

const chunkTokens = (tokens: string[]): number[][] => {
  if (!tokens.length) {
    return [];
  }

  const stride = Math.max(1, CHUNK_SIZE - CHUNK_OVERLAP);
  const ranges: number[][] = [];

  for (let start = 0; start < tokens.length; start += stride) {
    const end = Math.min(tokens.length, start + CHUNK_SIZE);
    ranges.push([start, end]);
    if (end >= tokens.length) {
      break;
    }
  }

  return ranges;
};

const buildChunksFromPdf = (
  source: GroundTruthSource,
  fileName: string,
  parsed: PdfParseResult,
): DocChunk[] => {
  const tokens = tokenize(parsed.text);
  const ranges = chunkTokens(tokens).filter(([start, end]) => end - start >= MIN_CHUNK_SIZE || end === tokens.length);
  const safeBase = fileName.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();

  return ranges.map<DocChunk>(([start, end], index) => ({
    id: createChunkId(source, safeBase || 'doc', index),
    namespace: source,
    content: detokenize(tokens.slice(start, end)),
    metadata: {
      sourceFile: fileName,
      tokenStart: start,
      tokenEnd: end,
      tokenCount: end - start,
      pageCount: parsed.numpages,
    },
  }));
};

const writeJsonl = async (chunks: DocChunk[]): Promise<void> => {
  const handle = await fs.promises.open(OUTPUT_PATH, 'w');

  try {
    for (const chunk of chunks) {
      await handle.appendFile(`${JSON.stringify(chunk)}\n`);
    }
  } finally {
    await handle.close();
  }
};

const sanitizeMetadata = (
  chunk: DocChunk,
): Record<string, string | number | boolean> => {
  const base: Record<string, string | number | boolean> = { namespace: chunk.namespace };
  const { metadata } = chunk;

  if (!metadata || typeof metadata !== 'object') {
    return base;
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      base[key] = value;
    }
  }

  return base;
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
};

const upsertChunksToChroma = async (chunks: DocChunk[]): Promise<void> => {
  const chromaUrl = process.env.CHROMA_URL ?? DEFAULT_CHROMA_URL;
  const collectionName = process.env.CHROMA_COLLECTION ?? DEFAULT_COLLECTION;
  const batchSize = Math.max(1, Number.parseInt(process.env.CHROMA_BATCH_SIZE ?? '64', 10) || 64);

  const client = new ChromaClient({ host: chromaUrl });
  const embeddingFunction = new OllamaEmbeddingFunction({
      url: DEFAULT_BASE_URL,
      model: DEFAULT_MODEL,
    });
  
    const collection = await client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction,
    });

  console.info(`[INGEST] CHROMA_URL=${chromaUrl} CHROMA_COLLECTION=${collectionName} BATCH_SIZE=${batchSize}`);

  const batches = chunkArray(chunks, batchSize);

  for (const batch of batches) {
    await collection.upsert({
      ids: batch.map((chunk) => chunk.id),
      documents: batch.map((chunk) => chunk.content),
      metadatas: batch.map((chunk) => sanitizeMetadata(chunk)),
    });
  }

  console.info(
    `Upserted ${chunks.length} chunk(s) to Chroma collection "${collectionName}" at ${chromaUrl}. (${batches.length} batch(es))`,
  );
};

const processPdfs = async (pdfPaths: string[]): Promise<DocChunk[]> => {
  const allChunks: DocChunk[] = [];

  for (const pdfPath of pdfPaths) {
    const buffer = await fs.promises.readFile(pdfPath);
    const parsed = await pdfParse(buffer);
    const source = inferSource(pdfPath);
    const fileName = path.basename(pdfPath);
    const chunks = buildChunksFromPdf(source, fileName, parsed);

    if (!chunks.length) {
      console.warn(`No chunks generated for ${fileName}.`);
    }

    allChunks.push(...chunks);
  }

  return allChunks;
};

const main = async (): Promise<void> => {
  await ensureDataDir();

  let pdfPaths: string[];
  try {
    pdfPaths = await listPdfFiles();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('docs directory not found. Please add PDFs to ./docs before running ingest.');
    }
    throw error;
  }

  if (pdfPaths.length === 0) {
    console.warn('No PDF files found in ./docs. Nothing to ingest.');
    return;
  }

  console.info(`Found ${pdfPaths.length} PDF file(s). Extracting text...`);
  const chunks = await processPdfs(pdfPaths);

  if (!chunks.length) {
    console.warn('No chunks generated from PDFs. Skipping write.');
    return;
  }

  await writeJsonl(chunks);
  console.info(`Wrote ${chunks.length} chunk(s) to ${OUTPUT_PATH}.`);
  try {
    await upsertChunksToChroma(chunks);
  } catch (error) {
    console.error('Failed to upsert embeddings to Chroma.');
    throw error;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
