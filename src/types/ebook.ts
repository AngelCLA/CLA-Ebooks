export type Quality = "normal" | "high" | "maximum";

export interface PdfFile {
  path: string;
  name: string;
  sizeBytes: number;
  pageCount: number;
}

export interface BackgroundImage {
  path: string;
  name: string;
}

export interface EbookResult {
  outputPath: string;
  zipPath: string;
  pageCount: number;
  sizeBytes: number;
  name: string;
}
