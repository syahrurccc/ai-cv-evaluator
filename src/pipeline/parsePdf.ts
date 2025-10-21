import fs from 'node:fs/promises';
import pdfParse from 'pdf-parse';

export type ParsedPdf = {
  text: string;
  pages: number;
};

export const parsePdf = async (filePath: string): Promise<ParsedPdf> => {
  const fileBuffer = await fs.readFile(filePath);
  const result = (await pdfParse(fileBuffer)) as { text?: string; numpages?: number };

  const text = (result.text ?? '').trim();
  const pages = typeof result.numpages === 'number' ? Math.max(0, Math.trunc(result.numpages)) : 0;

  return {
    text,
    pages,
  };
};
