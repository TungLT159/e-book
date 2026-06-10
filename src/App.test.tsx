import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReadingProgressRecord, ReadingProgressStore } from './types/electron';

vi.mock('./hooks/usePdfBookLoader', () => ({
  usePdfBookLoader: () => ({
    loading: false,
    books: [
      {
        config: {
          id: 'book_001',
          title: 'Tuyển tập truyện ngắn hay Việt Nam',
          pdfPath: '/books/book.pdf',
          thumbnail: '/books/book.png',
          pageCount: 270,
          ageRange: '12+',
          subject: 'Văn học',
          keywords: [],
          favorite: false,
        },
        pages: [],
        loaded: true,
      },
    ],
  }),
}));

vi.mock('./components/InteractivePdfFlipbook', () => ({
  InteractivePdfFlipbook: ({
    bookId,
    savedProgress,
    onProgressChange,
    onBackToLibrary,
  }: {
    bookId: string;
    savedProgress: ReadingProgressRecord | null;
    onProgressChange: (progress: ReadingProgressRecord) => void;
    onBackToLibrary: () => void;
  }) => (
    <section aria-label="Test reader">
      <p>Reader book: {bookId}</p>
      <p>Resume page: {savedProgress ? savedProgress.lastPageIndex + 1 : 'none'}</p>
      <button
        type="button"
        onClick={() => onProgressChange({
          bookId,
          lastPageIndex: 8,
          progressPercent: 75,
          completed: false,
          lastOpenedAt: '2026-06-10T01:00:00.000Z',
        })}
      >
        Save page 9
      </button>
      <button type="button" onClick={onBackToLibrary}>Back to library</button>
    </section>
  ),
}));

import App from './App';

const loadedProgress: ReadingProgressRecord = {
  bookId: 'book_001',
  lastPageIndex: 4,
  progressPercent: 50,
  completed: false,
  lastOpenedAt: '2026-06-10T00:00:00.000Z',
};

function storeWith(progress: ReadingProgressRecord): ReadingProgressStore {
  return {
    version: 1,
    updatedAt: progress.lastOpenedAt,
    books: { [progress.bookId]: progress },
  };
}

describe('App reading progress integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads once, restores an already-open reader, persists changes, and updates the library badge', async () => {
    const user = userEvent.setup();
    let finishLoading!: (store: ReadingProgressStore) => void;
    const getAll = vi.fn(() => new Promise<ReadingProgressStore>((resolve) => {
      finishLoading = resolve;
    }));
    const save = vi.fn(async (progress: ReadingProgressRecord) => storeWith(progress));
    window.readingProgress = { getAll, save, delete: vi.fn() };

    render(<App />);

    expect(getAll).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', {
      name: 'Đọc sách: Tuyển tập truyện ngắn hay Việt Nam',
    }));
    expect(screen.getByText('Reader book: book_001')).toBeInTheDocument();
    expect(screen.getByText('Resume page: none')).toBeInTheDocument();

    finishLoading(storeWith(loadedProgress));
    expect(await screen.findByText('Resume page: 5')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save page 9' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      bookId: 'book_001',
      lastPageIndex: 8,
      progressPercent: 75,
    })));
    await user.click(screen.getByRole('button', { name: 'Back to library' }));

    expect(await screen.findByRole('button', {
      name: 'Đọc sách: Tuyển tập truyện ngắn hay Việt Nam. 75%. Tiếp tục từ trang 9',
    })).toBeInTheDocument();
  });
});
