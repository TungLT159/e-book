import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookRecord } from '../data/books';

vi.mock('./pdfWorker', () => ({ PDF_WORKER_URL: '' }));

const mockGetPage = vi.fn();
const mockRender = vi.fn();
const mockGetDocument = vi.fn();

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

import { usePdfBookLoader } from './usePdfBookLoader';

const configs: BookRecord[] = [
  {
    id: 'b1',
    title: 'Book 1',
    pdfPath: '/books/b1.pdf',
    thumbnail: '/books/b1.png',
    pageCount: 12,
    ageRange: '12+',
    subject: 'Test',
    keywords: [],
    favorite: false,
  },
  {
    id: 'b2',
    title: 'Book 2',
    pdfPath: '/books/b2.pdf',
    thumbnail: '/books/b2.png',
    pageCount: 14,
    ageRange: '10+',
    subject: 'Test',
    keywords: [],
    favorite: true,
  },
];

describe('usePdfBookLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocument.mockReset();
    mockGetPage.mockReset();
    mockRender.mockReset();

    mockGetPage.mockResolvedValue({
      getViewport: vi.fn().mockReturnValue({ width: 800, height: 1100 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    });

    mockRender.mockReturnValue({ promise: Promise.resolve() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockCanvas() {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({} as CanvasRenderingContext2D);
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
    ) {
      cb(new Blob([''], { type: 'image/jpeg' }));
    });
  }

  it('starts with loading state', () => {
    mockGetDocument.mockReturnValue({ promise: new Promise(() => {}) });
    const { result } = renderHook(() => usePdfBookLoader(configs));
    expect(result.current.loading).toBe(true);
    expect(result.current.books).toEqual([]);
  });

  it('loads pages for multiple books', async () => {
    mockCanvas();
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 3,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 800, height: 1100 }),
          render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
        }),
      }),
    });

    const { result } = renderHook(() => usePdfBookLoader(configs));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.books).toHaveLength(2);
    expect(result.current.books[0].loaded).toBe(true);
    expect(result.current.books[0].pages).toHaveLength(3);
    expect(result.current.books[0].pages[0].title).toBe('Page 1');
  });

  it('handles PDF load error gracefully', async () => {
    mockGetDocument.mockReturnValue({
      promise: Promise.reject(new Error('Invalid PDF')),
    });

    const { result } = renderHook(() => usePdfBookLoader([configs[0]]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.books[0].loaded).toBe(false);
    expect(result.current.books[0].error).toBe('Invalid PDF');
  });
});
