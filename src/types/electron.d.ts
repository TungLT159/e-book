export {};

declare global {
  interface Window {
    edgeTts?: {
      synthesize: (text: string, options?: { voice?: string; rate?: string }) => Promise<ArrayBuffer | Uint8Array>;
      getVoices?: () => Promise<Array<{
        ShortName?: string;
        FriendlyName?: string;
        Locale?: string;
        Name?: string;
      }>>;
    };
    audioCache?: {
      getOrCreateEdgeTtsAudioCacheFile: (payload: {
        bookKey: string;
        voice: string;
        rate: string;
        chunkIndex: number;
        chunkText: string;
      }) => Promise<{ audioPath: string; audioUrl?: string; cacheHit: boolean }>;
      prepareEdgeTtsAudioCacheFile?: (payload: {
        bookKey: string;
        voice: string;
        rate: string;
        chunkIndex: number;
        chunkText: string;
      }) => Promise<{ audioPath: string; audioUrl?: string; cacheHit: boolean }>;
    };
    debugTools?: {
      writeExtractedText?: (payload: {
        title: string;
        pdfPath: string;
        pages: string[];
      }) => Promise<string>;
      readExtractedTextPage?: (filePath: string, pageNumber: number) => Promise<string>;
      emptyExtractedTextFile?: (filePath: string) => Promise<void>;
    };
  }
}
