import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReadingProgressRecord } from '../types/electron';

type ProgressByBookId = Record<string, ReadingProgressRecord>;

export function useReadingProgress() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [progressByBookId, setProgressByBookId] = useState<ProgressByBookId>({});
  const isMounted = useRef(true);
  const mutationGeneration = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    let cancelled = false;
    const loadMutationGeneration = mutationGeneration.current;

    async function loadProgress() {
      try {
        const store = await window.readingProgress?.getAll();
        if (!cancelled && mutationGeneration.current === loadMutationGeneration && store) {
          setProgressByBookId(store.books);
        }
      } catch {
        // Keep the hook safe when the bridge rejects.
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    }

    loadProgress();

    return () => {
      cancelled = true;
      isMounted.current = false;
    };
  }, []);

  const getBookProgress = useCallback(
    (bookId: string) => progressByBookId[bookId] ?? null,
    [progressByBookId],
  );

  const saveBookProgress = useCallback(async (payload: ReadingProgressRecord) => {
    const generation = ++mutationGeneration.current;
    try {
      const store = await window.readingProgress?.save(payload);
      if (isMounted.current && mutationGeneration.current === generation && store) {
        setProgressByBookId(store.books);
      }
    } catch {
      // Keep callers and component tree safe on bridge failure.
    }
  }, []);

  const deleteBookProgress = useCallback(async (bookId: string) => {
    const generation = ++mutationGeneration.current;
    try {
      const store = await window.readingProgress?.delete(bookId);
      if (isMounted.current && mutationGeneration.current === generation && store) {
        setProgressByBookId(store.books);
      }
    } catch {
      // Keep callers and component tree safe on bridge failure.
    }
  }, []);

  return {
    isLoaded,
    progressByBookId,
    getBookProgress,
    saveBookProgress,
    deleteBookProgress,
  };
}
