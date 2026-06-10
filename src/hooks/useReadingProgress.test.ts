import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReadingProgressRecord, ReadingProgressStore } from '../types/electron';
import { useReadingProgress } from './useReadingProgress';

const emptyStore = (updatedAt = '2024-01-01T00:00:00.000Z'): ReadingProgressStore => ({
  version: 1,
  updatedAt,
  books: {},
});

const progressRecord = (bookId: string, overrides: Partial<ReadingProgressRecord> = {}): ReadingProgressRecord => ({
  bookId,
  lastPageIndex: 4,
  progressPercent: 50,
  completed: false,
  lastOpenedAt: '2024-01-02T00:00:00.000Z',
  ...overrides,
});

const storeWith = (...records: ReadingProgressRecord[]): ReadingProgressStore => ({
  version: 1,
  updatedAt: '2024-01-03T00:00:00.000Z',
  books: Object.fromEntries(records.map((record) => [record.bookId, record])),
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

const storeWithTrackedBooks = (books: Record<string, ReadingProgressRecord>) => {
  let booksReadCount = 0;
  const store = {
    version: 1,
    updatedAt: '2024-01-03T00:00:00.000Z',
    get books() {
      booksReadCount += 1;
      return books;
    },
  } satisfies ReadingProgressStore;

  return { store, getBooksReadCount: () => booksReadCount };
};

describe('useReadingProgress', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete window.readingProgress;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.readingProgress;
  });

  it('loads progress from the bridge on mount and marks loaded', async () => {
    const record = progressRecord('book-1');
    const getAll = vi.fn().mockResolvedValue(storeWith(record));
    window.readingProgress = {
      getAll,
      save: vi.fn(),
      delete: vi.fn(),
    };

    const { result } = renderHook(() => useReadingProgress());

    expect(result.current.isLoaded).toBe(false);
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(getAll).toHaveBeenCalledTimes(1);
    expect(result.current.progressByBookId).toEqual({ 'book-1': record });
  });

  it('loads and saves progress under React StrictMode', async () => {
    const initialRecord = progressRecord('book-1', { progressPercent: 10 });
    const savedRecord = progressRecord('book-2', { progressPercent: 80 });
    window.readingProgress = {
      getAll: vi.fn().mockResolvedValue(storeWith(initialRecord)),
      save: vi.fn().mockResolvedValue(storeWith(initialRecord, savedRecord)),
      delete: vi.fn(),
    };
    const { result } = renderHook(() => useReadingProgress(), { reactStrictMode: true });

    await waitFor(() => expect(window.readingProgress?.getAll).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.progressByBookId).toEqual({ 'book-1': initialRecord });

    await act(async () => {
      await result.current.saveBookProgress(savedRecord);
    });

    expect(result.current.progressByBookId).toEqual({
      'book-1': initialRecord,
      'book-2': savedRecord,
    });
  });

  it('ignores a stale first StrictMode load that resolves after the second load', async () => {
    const staleRecord = progressRecord('stale-book');
    const currentRecord = progressRecord('current-book');
    const firstLoad = deferred<ReadingProgressStore>();
    const secondLoad = deferred<ReadingProgressStore>();
    window.readingProgress = {
      getAll: vi.fn().mockReturnValueOnce(firstLoad.promise).mockReturnValueOnce(secondLoad.promise),
      save: vi.fn(),
      delete: vi.fn(),
    };

    const { result } = renderHook(() => useReadingProgress(), { reactStrictMode: true });
    await waitFor(() => expect(window.readingProgress?.getAll).toHaveBeenCalledTimes(2));

    await act(async () => {
      secondLoad.resolve(storeWith(currentRecord));
      await secondLoad.promise;
    });
    expect(result.current.progressByBookId).toEqual({ 'current-book': currentRecord });

    await act(async () => {
      firstLoad.resolve(storeWith(staleRecord));
      await firstLoad.promise;
    });

    expect(result.current.progressByBookId).toEqual({ 'current-book': currentRecord });
  });

  it('does not access initial load data or warn when it resolves after unmount', async () => {
    const record = progressRecord('book-1');
    const initialLoad = deferred<ReadingProgressStore>();
    const loadedStore = storeWithTrackedBooks({ 'book-1': record });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    window.readingProgress = {
      getAll: vi.fn().mockReturnValue(initialLoad.promise),
      save: vi.fn(),
      delete: vi.fn(),
    };

    const { unmount } = renderHook(() => useReadingProgress());
    unmount();

    await act(async () => {
      initialLoad.resolve(loadedStore.store);
      await initialLoad.promise;
    });

    expect(loadedStore.getBooksReadCount()).toBe(0);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('updates progressByBookId when store data changes', async () => {
    const initialRecord = progressRecord('book-1', { lastPageIndex: 1, progressPercent: 10 });
    const savedRecord = progressRecord('book-2', { lastPageIndex: 8, progressPercent: 80 });
    window.readingProgress = {
      getAll: vi.fn().mockResolvedValue(storeWith(initialRecord)),
      save: vi.fn().mockResolvedValue(storeWith(initialRecord, savedRecord)),
      delete: vi.fn(),
    };

    const { result } = renderHook(() => useReadingProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.saveBookProgress(savedRecord);
    });

    expect(result.current.progressByBookId).toEqual({
      'book-1': initialRecord,
      'book-2': savedRecord,
    });
  });

  it('keeps a saved state when the pending initial load resolves afterward', async () => {
    const initialLoad = deferred<ReadingProgressStore>();
    const savedRecord = progressRecord('book-1', { progressPercent: 80 });
    window.readingProgress = {
      getAll: vi.fn().mockReturnValue(initialLoad.promise),
      save: vi.fn().mockResolvedValue(storeWith(savedRecord)),
      delete: vi.fn(),
    };

    const { result } = renderHook(() => useReadingProgress());

    await act(async () => {
      await result.current.saveBookProgress(savedRecord);
    });
    expect(result.current.progressByBookId).toEqual({ 'book-1': savedRecord });

    await act(async () => {
      initialLoad.resolve(emptyStore());
      await initialLoad.promise;
    });

    expect(result.current.progressByBookId).toEqual({ 'book-1': savedRecord });
    expect(result.current.isLoaded).toBe(true);
  });

  it('keeps the newest-started save response when saves resolve in reverse order', async () => {
    const firstSave = deferred<ReadingProgressStore>();
    const secondSave = deferred<ReadingProgressStore>();
    const olderRecord = progressRecord('book-1', { progressPercent: 20 });
    const newerRecord = progressRecord('book-1', { progressPercent: 90 });
    window.readingProgress = {
      getAll: vi.fn().mockResolvedValue(emptyStore()),
      save: vi.fn().mockReturnValueOnce(firstSave.promise).mockReturnValueOnce(secondSave.promise),
      delete: vi.fn(),
    };

    const { result } = renderHook(() => useReadingProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    const olderSavePromise = result.current.saveBookProgress(olderRecord);
    const newerSavePromise = result.current.saveBookProgress(newerRecord);

    await act(async () => {
      secondSave.resolve(storeWith(newerRecord));
      await newerSavePromise;
    });
    await act(async () => {
      firstSave.resolve(storeWith(olderRecord));
      await olderSavePromise;
    });

    expect(result.current.progressByBookId).toEqual({ 'book-1': newerRecord });
  });

  it('keeps a latest-started delete when an earlier save resolves afterward', async () => {
    const saveDeferred = deferred<ReadingProgressStore>();
    const deleteDeferred = deferred<ReadingProgressStore>();
    const record = progressRecord('book-1');
    window.readingProgress = {
      getAll: vi.fn().mockResolvedValue(emptyStore()),
      save: vi.fn().mockReturnValue(saveDeferred.promise),
      delete: vi.fn().mockReturnValue(deleteDeferred.promise),
    };

    const { result } = renderHook(() => useReadingProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    const savePromise = result.current.saveBookProgress(record);
    const deletePromise = result.current.deleteBookProgress(record.bookId);

    await act(async () => {
      deleteDeferred.resolve(emptyStore());
      await deletePromise;
    });
    await act(async () => {
      saveDeferred.resolve(storeWith(record));
      await savePromise;
    });

    expect(result.current.progressByBookId).toEqual({});
  });

  it('returns a progress record by book id or null', async () => {
    const record = progressRecord('book-1');
    window.readingProgress = {
      getAll: vi.fn().mockResolvedValue(storeWith(record)),
      save: vi.fn(),
      delete: vi.fn(),
    };

    const { result } = renderHook(() => useReadingProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.getBookProgress('book-1')).toEqual(record);
    expect(result.current.getBookProgress('missing-book')).toBeNull();
  });

  it('saves progress through the bridge and updates local state from returned store', async () => {
    const record = progressRecord('book-1', { lastPageIndex: 7, progressPercent: 70 });
    const save = vi.fn().mockResolvedValue(storeWith(record));
    window.readingProgress = {
      getAll: vi.fn().mockResolvedValue(emptyStore()),
      save,
      delete: vi.fn(),
    };

    const { result } = renderHook(() => useReadingProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.saveBookProgress(record);
    });

    expect(save).toHaveBeenCalledWith(record);
    expect(result.current.progressByBookId).toEqual({ 'book-1': record });
  });

  it('deletes progress through the bridge and removes it from local state', async () => {
    const record = progressRecord('book-1');
    const deleteProgress = vi.fn().mockResolvedValue(emptyStore());
    window.readingProgress = {
      getAll: vi.fn().mockResolvedValue(storeWith(record)),
      save: vi.fn(),
      delete: deleteProgress,
    };

    const { result } = renderHook(() => useReadingProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.deleteBookProgress('book-1');
    });

    expect(deleteProgress).toHaveBeenCalledWith('book-1');
    expect(result.current.progressByBookId).toEqual({});
  });

  it('stays safe with no bridge and empty state operations', async () => {
    const record = progressRecord('book-1');

    const { result } = renderHook(() => useReadingProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await expect(result.current.saveBookProgress(record)).resolves.toBeUndefined();
    await expect(result.current.deleteBookProgress('book-1')).resolves.toBeUndefined();
    expect(result.current.progressByBookId).toEqual({});
    expect(result.current.getBookProgress('book-1')).toBeNull();
  });

  it('handles bridge rejections without throwing from the hook API', async () => {
    const record = progressRecord('book-1');
    window.readingProgress = {
      getAll: vi.fn().mockRejectedValue(new Error('read failed')),
      save: vi.fn().mockRejectedValue(new Error('save failed')),
      delete: vi.fn().mockRejectedValue(new Error('delete failed')),
    };

    const { result } = renderHook(() => useReadingProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await expect(result.current.saveBookProgress(record)).resolves.toBeUndefined();
    await expect(result.current.deleteBookProgress('book-1')).resolves.toBeUndefined();
    expect(result.current.progressByBookId).toEqual({});
  });

  it('does not warn or crash when save resolves after unmount', async () => {
    const record = progressRecord('book-1');
    const saveDeferred = deferred<ReadingProgressStore>();
    const savedStore = storeWithTrackedBooks({ 'book-1': record });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    window.readingProgress = {
      getAll: vi.fn().mockResolvedValue(emptyStore()),
      save: vi.fn().mockReturnValue(saveDeferred.promise),
      delete: vi.fn(),
    };

    const { result, unmount } = renderHook(() => useReadingProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    const savePromise = result.current.saveBookProgress(record);
    unmount();

    await act(async () => {
      saveDeferred.resolve(savedStore.store);
      await savePromise;
    });

    expect(savedStore.getBooksReadCount()).toBe(0);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('does not warn or crash when delete resolves after unmount', async () => {
    const record = progressRecord('book-1');
    const deleteDeferred = deferred<ReadingProgressStore>();
    const deletedStore = storeWithTrackedBooks({});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    window.readingProgress = {
      getAll: vi.fn().mockResolvedValue(storeWith(record)),
      save: vi.fn(),
      delete: vi.fn().mockReturnValue(deleteDeferred.promise),
    };

    const { result, unmount } = renderHook(() => useReadingProgress());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    const deletePromise = result.current.deleteBookProgress('book-1');
    unmount();

    await act(async () => {
      deleteDeferred.resolve(deletedStore.store);
      await deletePromise;
    });

    expect(deletedStore.getBooksReadCount()).toBe(0);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });
});
