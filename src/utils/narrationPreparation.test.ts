import { describe, expect, it, vi } from 'vitest';
import { createNarrationPreparationCoordinator } from './narrationPreparation';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe('createNarrationPreparationCoordinator', () => {
  it.each([0, -1, Number.NaN, 1.5])(
    'rejects invalid background concurrency %s',
    (backgroundConcurrency) => {
      expect(() =>
        createNarrationPreparationCoordinator({
          prepare: async (key: string) => key,
          backgroundConcurrency,
        }),
      ).toThrowError(
        new RangeError('backgroundConcurrency must be a finite positive integer'),
      );
    },
  );

  it('deduplicates identical foreground preparations', async () => {
    const preparation = deferred<string>();
    const prepare = vi.fn(() => preparation.promise);
    const coordinator = createNarrationPreparationCoordinator({
      prepare,
      backgroundConcurrency: 2,
    });

    const first = coordinator.prepareForeground('page-1');
    const second = coordinator.prepareForeground('page-1');

    expect(first).toBe(second);
    expect(prepare).toHaveBeenCalledTimes(1);

    preparation.resolve('audio');
    await expect(first).resolves.toBe('audio');
  });

  it('prepares the same key again after successful work settles', async () => {
    const prepare = vi
      .fn<(key: string) => Promise<string>>()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    const coordinator = createNarrationPreparationCoordinator({
      prepare,
      backgroundConcurrency: 2,
    });

    await expect(coordinator.prepareForeground('page-1')).resolves.toBe('first');
    await expect(coordinator.prepareForeground('page-1')).resolves.toBe('second');
    expect(prepare).toHaveBeenCalledTimes(2);
  });

  it('limits background preparation concurrency and queues the third entry', async () => {
    const preparations = new Map<string, ReturnType<typeof deferred<string>>>();
    const prepare = vi.fn((key: string) => {
      const preparation = deferred<string>();
      preparations.set(key, preparation);
      return preparation.promise;
    });
    const coordinator = createNarrationPreparationCoordinator({
      prepare,
      backgroundConcurrency: 2,
    });

    const first = coordinator.prepareBackground('page-1');
    const second = coordinator.prepareBackground('page-2');
    const third = coordinator.prepareBackground('page-3');

    expect(prepare.mock.calls.map(([key]) => key)).toEqual(['page-1', 'page-2']);

    preparations.get('page-1')!.resolve('one');
    await expect(first).resolves.toBe('one');
    expect(prepare.mock.calls.map(([key]) => key)).toEqual([
      'page-1',
      'page-2',
      'page-3',
    ]);

    preparations.get('page-2')!.resolve('two');
    preparations.get('page-3')!.resolve('three');
    await expect(Promise.all([second, third])).resolves.toEqual(['two', 'three']);
  });

  it('releases a background slot after rejection and starts queued work', async () => {
    const firstPreparation = deferred<string>();
    const secondPreparation = deferred<string>();
    const prepare = vi.fn((key: string) =>
      key === 'page-1' ? firstPreparation.promise : secondPreparation.promise,
    );
    const coordinator = createNarrationPreparationCoordinator({
      prepare,
      backgroundConcurrency: 1,
    });

    const first = coordinator.prepareBackground('page-1');
    const second = coordinator.prepareBackground('page-2');
    expect(prepare).toHaveBeenCalledTimes(1);

    firstPreparation.reject(new Error('failed'));
    await expect(first).rejects.toThrow('failed');
    expect(prepare.mock.calls.map(([key]) => key)).toEqual(['page-1', 'page-2']);

    secondPreparation.resolve('two');
    await expect(second).resolves.toBe('two');
  });

  it('starts independent foreground work while background slots are occupied', async () => {
    const preparations = new Map<string, ReturnType<typeof deferred<string>>>();
    const prepare = vi.fn((key: string) => {
      const preparation = deferred<string>();
      preparations.set(key, preparation);
      return preparation.promise;
    });
    const coordinator = createNarrationPreparationCoordinator({
      prepare,
      backgroundConcurrency: 2,
    });

    const backgrounds = [
      coordinator.prepareBackground('page-1'),
      coordinator.prepareBackground('page-2'),
    ];
    const foreground = coordinator.prepareForeground('page-3');

    expect(prepare.mock.calls.map(([key]) => key)).toEqual([
      'page-1',
      'page-2',
      'page-3',
    ]);

    preparations.get('page-3')!.resolve('three');
    await expect(foreground).resolves.toBe('three');
    preparations.get('page-1')!.resolve('one');
    preparations.get('page-2')!.resolve('two');
    await Promise.all(backgrounds);
  });

  it('promotes queued matching background work without duplicate preparation', async () => {
    const preparations = new Map<string, ReturnType<typeof deferred<string>>>();
    const prepare = vi.fn((key: string) => {
      const preparation = deferred<string>();
      preparations.set(key, preparation);
      return preparation.promise;
    });
    const coordinator = createNarrationPreparationCoordinator({
      prepare,
      backgroundConcurrency: 2,
    });

    const first = coordinator.prepareBackground('page-1');
    const second = coordinator.prepareBackground('page-2');
    const queued = coordinator.prepareBackground('page-3');
    const promoted = coordinator.prepareForeground('page-3');

    expect(promoted).toBe(queued);
    expect(prepare.mock.calls.map(([key]) => key)).toEqual([
      'page-1',
      'page-2',
      'page-3',
    ]);

    preparations.get('page-3')!.resolve('three');
    await expect(Promise.all([queued, promoted])).resolves.toEqual(['three', 'three']);
    expect(prepare).toHaveBeenCalledTimes(3);

    preparations.get('page-1')!.resolve('one');
    preparations.get('page-2')!.resolve('two');
    await Promise.all([first, second]);
  });

  it('removes failed entries so a later foreground request can retry', async () => {
    const prepare = vi
      .fn<(key: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce('retried');
    const coordinator = createNarrationPreparationCoordinator({
      prepare,
      backgroundConcurrency: 2,
    });

    await expect(coordinator.prepareForeground('page-1')).rejects.toThrow('failed');
    await expect(coordinator.prepareForeground('page-1')).resolves.toBe('retried');
    expect(prepare).toHaveBeenCalledTimes(2);
  });
});
