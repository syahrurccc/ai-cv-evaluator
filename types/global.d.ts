declare module 'pdf-parse' {
  export interface PDFParseResult {
    text?: string;
    numpages?: number;
  }

  export default function pdfParse(
    data: Buffer | Uint8Array,
  ): Promise<PDFParseResult>;
}

declare module 'uuid' {
  export function v4(options?: { random?: Uint8Array }): string;
}
