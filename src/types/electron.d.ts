export {};

declare global {
  interface Window {
    edgeTts?: {
      synthesize: (text: string, options?: { voice?: string }) => Promise<ArrayBuffer | Uint8Array>;
      getVoices?: () => Promise<Array<{
        ShortName?: string;
        FriendlyName?: string;
        Locale?: string;
        Name?: string;
      }>>;
    };
  }
}
