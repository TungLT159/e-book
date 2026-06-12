interface NarrationPreparationOptions<T> {
  prepare: (key: string) => Promise<T>;
  backgroundConcurrency: number;
}

interface Entry<T> {
  key: string;
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  state: 'queued' | 'started';
}

export function createNarrationPreparationCoordinator<T>({
  prepare,
  backgroundConcurrency,
}: NarrationPreparationOptions<T>) {
  if (!Number.isFinite(backgroundConcurrency) || !Number.isInteger(backgroundConcurrency) || backgroundConcurrency <= 0) {
    throw new RangeError('backgroundConcurrency must be a finite positive integer');
  }

  const entries = new Map<string, Entry<T>>();
  const backgroundQueue: Entry<T>[] = [];
  let activeBackgroundCount = 0;

  const createEntry = (key: string): Entry<T> => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });

    const entry: Entry<T> = { key, promise, resolve, reject, state: 'queued' };
    entries.set(key, entry);
    return entry;
  };

  const start = (entry: Entry<T>, background: boolean) => {
    if (entry.state === 'started') return;
    entry.state = 'started';
    if (background) activeBackgroundCount += 1;

    let preparation: Promise<T>;
    try {
      preparation = prepare(entry.key);
    } catch (error) {
      preparation = Promise.reject(error);
    }

    preparation.then(
      (value) => {
        entries.delete(entry.key);
        entry.resolve(value);
        if (background) {
          activeBackgroundCount -= 1;
          drainBackgroundQueue();
        }
      },
      (error: unknown) => {
        entries.delete(entry.key);
        entry.reject(error);
        if (background) {
          activeBackgroundCount -= 1;
          drainBackgroundQueue();
        }
      },
    );
  };

  const drainBackgroundQueue = () => {
    while (
      activeBackgroundCount < backgroundConcurrency &&
      backgroundQueue.length > 0
    ) {
      start(backgroundQueue.shift()!, true);
    }
  };

  return {
    prepareForeground(key: string): Promise<T> {
      const existing = entries.get(key);
      if (existing) {
        if (existing.state === 'queued') {
          const queueIndex = backgroundQueue.indexOf(existing);
          if (queueIndex >= 0) backgroundQueue.splice(queueIndex, 1);
          start(existing, false);
        }
        return existing.promise;
      }

      const entry = createEntry(key);
      start(entry, false);
      return entry.promise;
    },

    prepareBackground(key: string): Promise<T> {
      const existing = entries.get(key);
      if (existing) return existing.promise;

      const entry = createEntry(key);
      backgroundQueue.push(entry);
      drainBackgroundQueue();
      return entry.promise;
    },
  };
}
