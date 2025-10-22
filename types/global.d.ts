type Buffer = Uint8Array;

declare namespace NodeJS {
  interface ErrnoException extends Error {
    code?: string;
  }
}

declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Uint8Array;
    }
  }
}

declare var process: {
  env: Record<string, string | undefined>;
};

declare function setImmediate(handler: (...args: unknown[]) => void, ...args: unknown[]): void;

declare module 'node:fs' {
  const fs: any;
  export = fs;
}

declare module 'node:fs/promises' {
  const fs: any;
  export = fs;
}

declare module 'node:path' {
  const path: any;
  export = path;
}

declare module 'express' {
  type RequestHandler = (...args: any[]) => any;

  interface RouterInstance {
    use: (...args: any[]) => RouterInstance;
    get: (...args: any[]) => RouterInstance;
    post: (...args: any[]) => RouterInstance;
  }

  interface Express extends RouterInstance {
    listen: (port: number, callback?: () => void) => unknown;
  }

  interface ExpressModule {
    (): Express;
    Router: () => RouterInstance;
    json: (...args: any[]) => RequestHandler;
    urlencoded: (...args: any[]) => RequestHandler;
  }

  const express: ExpressModule;
  const Router: () => RouterInstance;

  export default express;
  export { RequestHandler, Router, Express };
}

declare module 'multer' {
  interface Field {
    name: string;
    maxCount?: number;
  }

  interface StorageEngine {}

  interface Multer {
    fields: (fields: Field[]) => (req: any, res: any, next: any) => void;
    any: () => (req: any, res: any, next: any) => void;
  }

  interface DiskStorageOptions {
    destination?: (...args: any[]) => void;
    filename?: (...args: any[]) => void;
  }

  interface MulterModule {
    (options?: { storage?: StorageEngine }): Multer;
    diskStorage: (options: DiskStorageOptions) => StorageEngine;
  }

  const multer: MulterModule;
  export = multer;
}

declare module 'dotenv' {
  interface DotenvConfigOptions {
    path?: string;
  }

  interface DotenvResult {
    parsed?: Record<string, string>;
    error?: Error;
  }

  function config(options?: DotenvConfigOptions): DotenvResult;

  const dotenv: {
    config: typeof config;
  };

  export { config };
  export default dotenv;
}

declare module 'zod' {
  export const z: {
    object: (...args: any[]) => any;
    string: (...args: any[]) => any;
    number: (...args: any[]) => any;
    array: (...args: any[]) => any;
    literal: (...args: any[]) => any;
    union: (...args: any[]) => any;
    coerce: any;
    infer: any;
  };
}

declare module 'pdf-parse' {
  export interface PDFParseResult {
    text: string;
    numpages: number;
  }

  export default function pdfParse(data: Buffer | Uint8Array): Promise<PDFParseResult>;
}

declare module 'uuid' {
  export function v4(options?: { random?: Uint8Array }): string;
}

declare module 'openai' {
  const OpenAI: any;
  export default OpenAI;
}

declare module 'chromadb' {
  export class ChromaClient {
    constructor(options?: Record<string, unknown>);
    getOrCreateCollection(options: Record<string, unknown>): Promise<any>;
  }

  export class OpenAIEmbeddingFunction {
    constructor(options: Record<string, unknown>);
  }
}

declare module '@chroma-core/default-embed' {
  class DefaultEmbeddingFunction {
    constructor();
  }

  export { DefaultEmbeddingFunction };
}

declare module '@chroma-core/ollama' {
  type OllamaEmbeddingOptions = {
    url?: string;
    model?: string;
  };

  class OllamaEmbeddingFunction {
    constructor(options?: OllamaEmbeddingOptions);
  }

  export { OllamaEmbeddingFunction };
}
