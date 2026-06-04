import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useEffect, useState } from 'react';
import type { BookPage } from '../data/bookPages';
import type { BookRecord } from '../data/books';
import { PDF_WORKER_URL } from './pdfWorker';

export type PdfBookState = {
  config: BookRecord;
  pages: BookPage[];
  loaded: boolean;
  error?: string;
};

GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

async function renderPageToBlob(
  pdf: PDFDocumentProxy,
  pageNum: number,
  scale: number,
): Promise<BookPage> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) throw new Error(`Failed to render page ${pageNum}`);
  const url = URL.createObjectURL(blob);
  return { id: pageNum, title: `Page ${pageNum}`, image: url, thumbnail: url };
}

export function usePdfBookLoader(bookConfigs: BookRecord[]) {
  const [state, setState] = useState<{ books: PdfBookState[]; loading: boolean }>({
    books: [],
    loading: true,
  });

  useEffect(() => {
    const blobUrls: string[] = [];
    let cancelled = false;

    async function load() {
      const results: PdfBookState[] = [];
      for (const config of bookConfigs) {
        if (cancelled) break;
        try {
          const pdf = await getDocument({ url: config.pdfPath }).promise;
          const pages: BookPage[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            if (cancelled) break;
            const bookPage = await renderPageToBlob(pdf, i, 2);
            pages.push(bookPage);
            blobUrls.push(bookPage.image);
          }
          if (!cancelled) {
            results.push({ config, pages, loaded: true });
          } else {
            pages.forEach((p) => URL.revokeObjectURL(p.image));
          }
        } catch (err) {
          if (!cancelled) {
            results.push({
              config,
              pages: [],
              loaded: false,
              error: err instanceof Error ? err.message : 'Unknown error loading PDF',
            });
          }
        }
      }
      if (!cancelled) {
        setState({ books: results, loading: false });
      }
    }

    load();

    return () => {
      cancelled = true;
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [bookConfigs]);

  return state;
}
