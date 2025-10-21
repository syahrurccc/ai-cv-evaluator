import fs from 'node:fs';
import path from 'node:path';

type FileMetadata = {
  id: string;
  name: string;
  path: string;
};

const dataDir = path.resolve('.data');
const storePath = path.join(dataDir, 'files.json');

const filesById = new Map<string, FileMetadata>();

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

    const parsed = JSON.parse(raw) as FileMetadata[] | Record<string, FileMetadata>;
    const entriesArray = Array.isArray(parsed)
      ? parsed
      : Object.values(parsed ?? {});

    entriesArray.forEach((entry) => {
      if (entry?.id && entry?.path) {
        filesById.set(entry.id, entry);
      }
    });
  } catch (error) {
    console.error('Failed to load file store from disk:', error);
  }
};

const persistStore = (): void => {
  ensureDataDir();
  const payload = JSON.stringify(Array.from(filesById.values()), null, 2);
  fs.writeFileSync(storePath, payload);
};

ensureDataDir();
loadStoreFromDisk();

export const saveFile = (meta: FileMetadata): void => {
  filesById.set(meta.id, meta);
  try {
    persistStore();
  } catch (error) {
    console.error('Failed to persist file store:', error);
  }
};

export const getFilePathById = (id: string): string | undefined => {
  const entry = filesById.get(id);
  return entry?.path;
};
