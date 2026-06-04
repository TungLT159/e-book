import { describe, expect, it } from 'vitest';
import pdfjsPackage from 'pdfjs-dist/package.json';
import reactPdfPackage from 'react-pdf/package.json';
import { PDF_WORKER_URL } from './pdfWorker';

describe('PDF worker configuration', () => {
  it('uses the same pdfjs-dist version as react-pdf', () => {
    expect(pdfjsPackage.version).toBe(reactPdfPackage.dependencies['pdfjs-dist']);
  });

  it('cache-busts the worker URL with the active pdfjs-dist version', () => {
    expect(PDF_WORKER_URL).not.toContain('pdfjs-version=');
  });
});
