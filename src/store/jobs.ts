import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type JobRecord = {
  id: string;
  status: JobStatus;
  result?: unknown;
  error?: unknown;
};

const dataDir = path.resolve('.data');
const storePath = path.join(dataDir, 'jobs.json');

const jobsById = new Map<string, JobRecord>();

const ensureDataDir = (): void => {
  fs.mkdirSync(dataDir, { recursive: true });
};

const loadStoreFromDisk = (): void => {
  if (!fs.existsSync(storePath)) {
    return;
  }

  try {
    const raw = fs.readFileSync(storePath, 'utf-8');
    if (!raw.trim()) {
      return;
    }

    const parsed = JSON.parse(raw) as JobRecord[] | Record<string, JobRecord>;
    const entriesArray = Array.isArray(parsed) ? parsed : Object.values(parsed ?? {});

    entriesArray.forEach((entry) => {
      if (entry?.id && entry?.status) {
        jobsById.set(entry.id, entry);
      }
    });
  } catch (error) {
    console.error('Failed to load job store from disk:', error);
  }
};

const persistStore = (): void => {
  ensureDataDir();
  const payload = JSON.stringify(Array.from(jobsById.values()), null, 2);
  fs.writeFileSync(storePath, payload);
};

ensureDataDir();
loadStoreFromDisk();

export const createJob = (): JobRecord => {
  const job: JobRecord = {
    id: uuidv4(),
    status: 'queued',
  };

  jobsById.set(job.id, job);

  try {
    persistStore();
  } catch (error) {
    console.error('Failed to persist job store:', error);
  }

  return job;
};

export const updateJob = (id: string, patch: Partial<JobRecord>): JobRecord | undefined => {
  const existing = jobsById.get(id);
  if (!existing) {
    return undefined;
  }

  const updated: JobRecord = {
    ...existing,
    ...patch,
  };

  jobsById.set(id, updated);

  try {
    persistStore();
  } catch (error) {
    console.error('Failed to persist job store:', error);
  }

  return updated;
};

export const getJob = (id: string): JobRecord | undefined => jobsById.get(id);
