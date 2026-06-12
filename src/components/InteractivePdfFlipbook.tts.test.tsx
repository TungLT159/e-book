/// <reference types="node" />

import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractivePdfFlipbook } from './InteractivePdfFlipbook';
import { useInteractivePdfFlipbook } from './hooks/useInteractivePdfFlipbook';
import { sanitizeNarrationText } from '../utils/narration';

const pdfJsMock = vi.hoisted(() => {
  const getPage = vi.fn(async (pageNumber: number) => ({
    getTextContent: async () => ({
      items: (pageNumber === 1
        ? ['Trang một', 'nội dung mở đầu']
        : pageNumber === 2
          ? ['Trang hai', 'nội dung tiếp theo']
          : [`Trang ${pageNumber}`, 'nội dung tiếp theo']
      ).map((str) => ({ str })),
    }),
  }));
  const documents: Array<{ url: string; destroy: ReturnType<typeof vi.fn> }> = [];

  const getDocument = vi.fn(({ url }: { url: string }) => {
    const document = {
      url,
      numPages: 2,
      getPage,
      destroy: vi.fn(),
    };
    documents.push(document);

    return {
      promise: Promise.resolve(document),
    };
  });

  return { documents, getDocument, getPage };
});

const flipNext = vi.fn();
const flipPrev = vi.fn();
const flipTo = vi.fn();
const synthesize = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer);
type AudioCachePayload = { chunkIndex: number; chunkText: string; rate?: string };
type AudioCacheResult = {
  audioPath: string;
  audioUrl: string;
  cacheHit: boolean;
  timings?: { cacheLookupMs: number; synthesisMs: number };
};
const prepareEdgeTtsAudioCacheFile = vi.fn(async (payload: AudioCachePayload): Promise<AudioCacheResult> => ({
  audioPath: `C:\\Temp\\flipbook-react-electron\\audio-cache\\page-${payload.chunkIndex + 1}.mp3`,
  audioUrl: `file:///C:/Temp/flipbook-react-electron/audio-cache/page-${payload.chunkIndex + 1}.mp3`,
  cacheHit: false,
}));
const writeExtractedText = vi.fn(async () => 'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt');
const readExtractedTextPage = vi.fn(async (_filePath: string, pageNumber: number): Promise<string> =>
  pageNumber === 1
    ? 'Trang mộtnội dung mở đầu'
    : pageNumber === 2
      ? 'Trang hainội dung tiếp theo'
      : `Nội dung đọc từ file text trang ${pageNumber}`,
);
const getVoices = vi.fn(async () => [
  { ShortName: 'vi-VN-HoaiMyNeural', FriendlyName: 'Hoài My', Locale: 'vi-VN' },
  { ShortName: 'vi-VN-NamMinhNeural', FriendlyName: 'Nam Minh', Locale: 'vi-VN' },
]);
const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();
const load = vi.fn();
const performanceMark = vi.fn();
const performanceMeasure = vi.fn();

const narrationPreparationMockState = vi.hoisted(() => ({
  stalledBackgroundPages: new Set<number>(),
}));

vi.mock('../utils/narrationPreparation', async () => {
  const actual = await vi.importActual<typeof import('../utils/narrationPreparation')>('../utils/narrationPreparation');

  return {
    ...actual,
    createNarrationPreparationCoordinator<T>(options: Parameters<typeof actual.createNarrationPreparationCoordinator<T>>[0]) {
      const coordinator = actual.createNarrationPreparationCoordinator(options);
      const stalledBackground = new Map<string, { promise: Promise<T>; start: () => void }>();

      const shouldStallBackground = (key: string) => {
        try {
          const parsed = JSON.parse(key) as { page?: number };
          return typeof parsed.page === 'number' && narrationPreparationMockState.stalledBackgroundPages.has(parsed.page);
        } catch {
          return false;
        }
      };

      return {
        prepareBackground(key: string) {
          if (!shouldStallBackground(key)) {
            return coordinator.prepareBackground(key);
          }

          const existing = stalledBackground.get(key);
          if (existing) return existing.promise;

          let started = false;
          let resolveStalled!: (value: T) => void;
          let rejectStalled!: (reason: unknown) => void;
          const stalled = {
            promise: new Promise<T>((resolve, reject) => {
              resolveStalled = resolve;
              rejectStalled = reject;
            }),
            start: () => {
              if (started) return;
              started = true;
              void coordinator.prepareForeground(key).then(resolveStalled, rejectStalled).finally(() => {
                stalledBackground.delete(key);
              });
            },
          };
          stalledBackground.set(key, stalled);
          return stalled.promise;
        },
        prepareForeground(key: string) {
          const stalled = stalledBackground.get(key);
          if (stalled) {
            stalled.start();
            return stalled.promise;
          }

          return coordinator.prepareForeground(key);
        },
      };
    },
  };
});

function expectPreparedNarration(chunkText: string, options: { voice?: string; rate?: string; volume?: string } = {}) {
  return expect(prepareEdgeTtsAudioCacheFile).toHaveBeenCalledWith(
    expect.objectContaining({
      chunkText,
      voice: options.voice ?? 'vi-VN-NamMinhNeural',
      ...(options.rate !== undefined ? { rate: options.rate } : {}),
      ...(options.volume !== undefined ? { volume: options.volume } : {}),
    }),
  );
}

function countPreparedNarration(chunkText: string) {
  return prepareEdgeTtsAudioCacheFile.mock.calls.filter(([payload]) => payload.chunkText === chunkText).length;
}

function selectSleepTimer(optionName: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name: /hẹn giờ dừng đọc/i }));
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

vi.mock('react-pageflip', () => ({
  default: React.forwardRef(
    ({ children, onFlip }: { children: React.ReactNode; onFlip?: (event: { data: number }) => void }, ref) => {
      React.useImperativeHandle(ref, () => ({
        pageFlip: () => ({
          flipNext: () => {
            flipNext();
            onFlip?.({ data: 1 });
          },
          flipPrev: () => {
            flipPrev();
            onFlip?.({ data: 0 });
          },
          flip: (pageIndex: number) => {
            flipTo(pageIndex);
            onFlip?.({ data: pageIndex });
          },
        }),
      }));

      return <div>{children}</div>;
    },
  ),
}));

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  Document: ({ children, file, onLoadSuccess }: { children: React.ReactNode; file?: string; onLoadSuccess?: (pdf: { numPages: number }) => void }) => {
    React.useEffect(() => {
      if (file) {
        onLoadSuccess?.({ numPages: file.includes('multi-page-demo') ? 6 : 2 });
      }
    }, [file, onLoadSuccess]);

    return <div data-testid="mock-document">{children}</div>;
  },
  Page: ({ pageNumber }: { pageNumber: number }) => <div>PDF page {pageNumber}</div>,
}));

vi.mock('pdfjs-dist', () => ({
  getDocument: pdfJsMock.getDocument,
  GlobalWorkerOptions: { workerSrc: '' },
}));

const originalPerformanceMarkDescriptor = Object.getOwnPropertyDescriptor(window.performance, 'mark');
const originalPerformanceMeasureDescriptor = Object.getOwnPropertyDescriptor(window.performance, 'measure');

function restorePropertyDescriptor(
  target: object,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
  } else {
    Reflect.deleteProperty(target, property);
  }
}

describe('InteractivePdfFlipbook narration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    restorePropertyDescriptor(window.performance, 'mark', originalPerformanceMarkDescriptor);
    restorePropertyDescriptor(window.performance, 'measure', originalPerformanceMeasureDescriptor);
  });

  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    flipNext.mockClear();
    flipPrev.mockClear();
    flipTo.mockClear();
    synthesize.mockClear();
    prepareEdgeTtsAudioCacheFile.mockReset();
    prepareEdgeTtsAudioCacheFile.mockImplementation(async (payload: AudioCachePayload) => ({
      audioPath: `C:\\Temp\\flipbook-react-electron\\audio-cache\\page-${payload.chunkIndex + 1}.mp3`,
      audioUrl: `file:///C:/Temp/flipbook-react-electron/audio-cache/page-${payload.chunkIndex + 1}.mp3`,
      cacheHit: false,
    }));
    writeExtractedText.mockClear();
    readExtractedTextPage.mockClear();
    pdfJsMock.getDocument.mockClear();
    pdfJsMock.getPage.mockClear();
    pdfJsMock.documents.length = 0;
    getVoices.mockClear();
    play.mockClear();
    performanceMark.mockClear();
    performanceMeasure.mockClear();
    Object.defineProperty(window.performance, 'mark', {
      configurable: true,
      value: performanceMark,
    });
    Object.defineProperty(window.performance, 'measure', {
      configurable: true,
      value: performanceMeasure,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: play,
    });
    pause.mockClear();
    load.mockClear();
    narrationPreparationMockState.stalledBackgroundPages.clear();
    Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pause,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: load,
    });
    window.edgeTts = { synthesize, getVoices };
    window.audioCache = {
      getOrCreateEdgeTtsAudioCacheFile: vi.fn(),
      prepareEdgeTtsAudioCacheFile,
    };
    window.debugTools = { writeExtractedText, readExtractedTextPage };
  });

  it('prepares the foreground page in the audio cache, plays its file URL, and does not synthesize in the renderer', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(prepareEdgeTtsAudioCacheFile).toHaveBeenCalledTimes(1));
    expect(prepareEdgeTtsAudioCacheFile).toHaveBeenCalledWith({
      bookKey: 'Demo book',
      voice: 'vi-VN-NamMinhNeural',
      rate: '',
      volume: '',
      chunkIndex: 0,
      chunkText: 'Trang mộtnội dung mở đầu',
    });
    expect(synthesize).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Âm thanh đọc văn bản')).toHaveAttribute(
      'src',
      'file:///C:/Temp/flipbook-react-electron/audio-cache/page-1.mp3',
    );
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('records stable development performance stages from the auto-read action through successful playback', async () => {
    prepareEdgeTtsAudioCacheFile.mockResolvedValueOnce({
      audioPath: 'C:\\Temp\\flipbook-react-electron\\audio-cache\\page-1.mp3',
      audioUrl: 'file:///C:/Temp/flipbook-react-electron/audio-cache/page-1.mp3',
      cacheHit: false,
      timings: { cacheLookupMs: 4.5, synthesisMs: 18.25 },
    });
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    expect(performanceMark).toHaveBeenCalledWith('narration-start:1');

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

    const markNames = performanceMark.mock.calls.map(([name]) => String(name));
    const textStartMark = markNames.find((name) => name.startsWith('narration-text-start:'));
    const foregroundTimingId = textStartMark?.split(':').at(-1);
    expect(foregroundTimingId).toBeDefined();
    expect(markNames).toEqual(expect.arrayContaining([
      'narration-start:1',
      `narration-text-start:${foregroundTimingId}`,
      `narration-text-end:${foregroundTimingId}`,
      `narration-prepare-start:${foregroundTimingId}`,
      `narration-prepare-end:${foregroundTimingId}`,
      'narration-playing:1',
    ]));
    expect(performanceMeasure).toHaveBeenCalledWith(
      `narration-text:${foregroundTimingId}`,
      `narration-text-start:${foregroundTimingId}`,
      `narration-text-end:${foregroundTimingId}`,
    );
    expect(performanceMeasure).toHaveBeenCalledWith(
      `narration-prepare-miss:${foregroundTimingId}`,
      `narration-prepare-start:${foregroundTimingId}`,
      `narration-prepare-end:${foregroundTimingId}`,
    );
    expect(performanceMeasure).toHaveBeenCalledWith(
      `narration-cache-lookup:${foregroundTimingId}`,
      { start: 0, duration: 4.5 },
    );
    expect(performanceMeasure).toHaveBeenCalledWith(
      `narration-synthesis:${foregroundTimingId}`,
      { start: 0, duration: 18.25 },
    );
    expect(performanceMeasure).toHaveBeenCalledWith(
      'narration-startup:1',
      'narration-start:1',
      'narration-playing:1',
    );
    expect(performanceMark.mock.calls.flat()).not.toContain('Trang mộtnội dung mở đầu');
    expect(performanceMeasure.mock.calls.flat()).not.toContain('Trang mộtnội dung mở đầu');
  });

  it('keeps narration active when performance instrumentation throws', async () => {
    performanceMark.mockImplementation(() => {
      throw new Error('performance.mark unavailable');
    });
    performanceMeasure.mockImplementation(() => {
      throw new Error('performance.measure unavailable');
    });

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
    expect(screen.queryByText(/performance\.(?:mark|measure) unavailable/i)).not.toBeInTheDocument();
  });

  it('keeps narration active when performance instrumentation methods are missing', async () => {
    Object.defineProperty(window.performance, 'mark', { configurable: true, value: undefined });
    Object.defineProperty(window.performance, 'measure', { configurable: true, value: undefined });

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
  });

  it('only measures startup for the current operation after a stale start completes', async () => {
    let resolveStalePlay: () => void = () => undefined;
    play
      .mockReturnValueOnce(new Promise<void>((resolve) => {
        resolveStalePlay = resolve;
      }))
      .mockResolvedValueOnce(undefined);

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /đang tạo giọng đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveStalePlay();
      await Promise.resolve();
    });

    const startupMeasures = performanceMeasure.mock.calls.filter(([name]) =>
      String(name).startsWith('narration-startup:'),
    );
    expect(startupMeasures).toEqual([
      ['narration-startup:2', 'narration-start:2', 'narration-playing:2'],
    ]);
    expect(performanceMark).not.toHaveBeenCalledWith('narration-playing:1');
    expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
  });

  it('plays a cache-hit audio URL without synthesizing in the renderer', async () => {
    prepareEdgeTtsAudioCacheFile.mockResolvedValueOnce({
      audioPath: 'C:\\Temp\\flipbook-react-electron\\audio-cache\\cached-page-1.mp3',
      audioUrl: 'file:///C:/Temp/flipbook-react-electron/audio-cache/cached-page-1.mp3',
      cacheHit: true,
    });

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(prepareEdgeTtsAudioCacheFile).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Âm thanh đọc văn bản')).toHaveAttribute(
      'src',
      'file:///C:/Temp/flipbook-react-electron/audio-cache/cached-page-1.mp3',
    );
    expect(play).toHaveBeenCalledTimes(1);
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('starts lookahead preparation for the next two pages only after playback starts', async () => {
    let resolvePlay: () => void = () => undefined;
    play.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolvePlay = resolve;
    }));

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/multi-page-demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));
    expect(prepareEdgeTtsAudioCacheFile).not.toHaveBeenCalledWith(
      expect.objectContaining({ chunkText: 'Trang hainội dung tiếp theo' }),
    );
    expect(prepareEdgeTtsAudioCacheFile).not.toHaveBeenCalledWith(
      expect.objectContaining({ chunkText: 'Trang 3nội dung tiếp theo' }),
    );

    await act(async () => {
      resolvePlay();
    });

    await waitFor(() => expectPreparedNarration('Trang hainội dung tiếp theo'));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
    await waitFor(() => expectPreparedNarration('Trang 3nội dung tiếp theo'));
  });

  it('does not prepare delayed lookahead narration after automatic reading stops', async () => {
    let resolveLookaheadText!: (content: { items: { str: string }[] }) => void;
    const delayedLookaheadText = new Promise<{ items: { str: string }[] }>((resolve) => {
      resolveLookaheadText = resolve;
    });
    const pendingPageThree = new Promise<never>(() => undefined);
    pdfJsMock.getPage
      .mockImplementationOnce(() => Promise.resolve({
        getTextContent: async () => ({
          items: [{ str: 'Trang một' }, { str: 'nội dung mở đầu' }],
        }),
      }))
      .mockImplementationOnce(() => Promise.resolve({ getTextContent: () => delayedLookaheadText }))
      .mockImplementationOnce(() => pendingPageThree);

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/multi-page-demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pdfJsMock.getPage).toHaveBeenCalledWith(2));
    expect(prepareEdgeTtsAudioCacheFile).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /^dừng đọc$/i }));

    await act(async () => {
      resolveLookaheadText({ items: [{ str: 'Trang hai' }, { str: 'nội dung tiếp theo' }] });
      await delayedLookaheadText;
    });

    expect(prepareEdgeTtsAudioCacheFile).toHaveBeenCalledTimes(1);
    expect(countPreparedNarration('Trang hainội dung tiếp theo')).toBe(0);
  });

  it('isolates background preparation failures from active narration and retries later foreground playback', async () => {
    prepareEdgeTtsAudioCacheFile.mockImplementation(async (payload: AudioCachePayload) => {
      if (payload.chunkIndex === 1 && countPreparedNarration('Trang hainội dung tiếp theo') === 1) {
        throw new Error('background prepare failed');
      }

      return {
        audioPath: `C:\\Temp\\flipbook-react-electron\\audio-cache\\page-${payload.chunkIndex + 1}.mp3`,
        audioUrl: `file:///C:/Temp/flipbook-react-electron/audio-cache/page-${payload.chunkIndex + 1}.mp3`,
        cacheHit: false,
      };
    });

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/multi-page-demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));
    await waitFor(() => expect(countPreparedNarration('Trang hainội dung tiếp theo')).toBe(1));
    expect(screen.queryByText('background prepare failed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /đọc trang tiếp theo/i }));

    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(1));
    await waitFor(() => expect(countPreparedNarration('Trang hainội dung tiếp theo')).toBe(2));
    expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
  });

  it('shares a queued background preparation when the same page is promoted to foreground', async () => {
    let resolvePageTwo!: (result: { audioPath: string; audioUrl: string; cacheHit: boolean }) => void;
    prepareEdgeTtsAudioCacheFile.mockImplementation((payload: AudioCachePayload) => {
      if (payload.chunkIndex === 1) {
        return new Promise((resolve) => {
          resolvePageTwo = resolve;
        });
      }

      return Promise.resolve({
        audioPath: `C:\\Temp\\flipbook-react-electron\\audio-cache\\page-${payload.chunkIndex + 1}.mp3`,
        audioUrl: `file:///C:/Temp/flipbook-react-electron/audio-cache/page-${payload.chunkIndex + 1}.mp3`,
        cacheHit: false,
      });
    });

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/multi-page-demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(countPreparedNarration('Trang hainội dung tiếp theo')).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: /đọc trang tiếp theo/i }));
    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(1));
    expect(countPreparedNarration('Trang hainội dung tiếp theo')).toBe(1);

    await act(async () => {
      resolvePageTwo({
        audioPath: 'C:\\Temp\\flipbook-react-electron\\audio-cache\\page-2.mp3',
        audioUrl: 'file:///C:/Temp/flipbook-react-electron/audio-cache/page-2.mp3',
        cacheHit: false,
      });
    });

    await waitFor(() => expect(screen.getByLabelText('Âm thanh đọc văn bản')).toHaveAttribute(
      'src',
      'file:///C:/Temp/flipbook-react-electron/audio-cache/page-2.mp3',
    ));
    expect(countPreparedNarration('Trang hainội dung tiếp theo')).toBe(1);
  });

  it('promotes queued background preparation when the same page becomes foreground', async () => {
    narrationPreparationMockState.stalledBackgroundPages.add(1);

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/multi-page-demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));
    await waitFor(() => expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument());
    await waitFor(() => expect(pdfJsMock.getPage).toHaveBeenCalledWith(2));
    expect(countPreparedNarration('Trang hainội dung tiếp theo')).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: /đọc trang tiếp theo/i }));

    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(1));
    await waitFor(() => expectPreparedNarration('Trang hainội dung tiếp theo'));
    expect(countPreparedNarration('Trang hainội dung tiếp theo')).toBe(1);
    await waitFor(() => expect(screen.getByLabelText('Âm thanh đọc văn bản')).toHaveAttribute(
      'src',
      'file:///C:/Temp/flipbook-react-electron/audio-cache/page-2.mp3',
    ));
  });

  it('starts new-generation lookahead while old-generation lookahead preparations are stalled', async () => {
    const stalledOldLookahead = new Promise<never>(() => undefined);
    prepareEdgeTtsAudioCacheFile.mockImplementation((payload: AudioCachePayload) => {
      if (!payload.rate && (payload.chunkIndex === 1 || payload.chunkIndex === 2)) {
        return stalledOldLookahead;
      }

      return Promise.resolve({
        audioPath: `C:\\Temp\\flipbook-react-electron\\audio-cache\\page-${payload.chunkIndex + 1}-${payload.rate || 'default'}.mp3`,
        audioUrl: `file:///C:/Temp/flipbook-react-electron/audio-cache/page-${payload.chunkIndex + 1}-${payload.rate || 'default'}.mp3`,
        cacheHit: false,
      });
    });

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/multi-page-demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang hainội dung tiếp theo', { rate: '' }));
    await waitFor(() => expectPreparedNarration('Trang 3nội dung tiếp theo', { rate: '' }));

    fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));
    fireEvent.change(screen.getByLabelText('Tốc độ đọc'), { target: { value: '25' } });

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu', { rate: '+25%' }));
    await waitFor(() => expectPreparedNarration('Trang hainội dung tiếp theo', { rate: '+25%' }));
    await waitFor(() => expectPreparedNarration('Trang 3nội dung tiếp theo', { rate: '+25%' }));
  });

  it('reads PDF text with Edge TTS and flips after narration ends', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));
    expect(writeExtractedText).not.toHaveBeenCalled();
    expect(readExtractedTextPage).not.toHaveBeenCalled();
    expect(pdfJsMock.getPage).toHaveBeenCalled();
    expect(pdfJsMock.getPage).toHaveBeenCalledWith(1);
    expect(play).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    act(() => {
      narrationAudio.dispatchEvent(new Event('ended'));
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await act(async () => undefined);
    await act(async () => undefined);

    expect(flipTo).toHaveBeenCalledWith(1);
    expectPreparedNarration('Trang hainội dung tiếp theo');
  });

  it('destroys the cached PDF document when the PDF path changes', async () => {
    const { rerender } = render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(pdfJsMock.documents).toHaveLength(1));
    const firstDocument = pdfJsMock.documents[0];
    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));

    rerender(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/second-demo.pdf" />);

    await waitFor(() => expect(firstDocument.destroy).toHaveBeenCalledTimes(1));
  });

  it('waits for the page flip to settle before reading the next page', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));
    expect(play).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    act(() => {
      narrationAudio.dispatchEvent(new Event('ended'));
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(flipTo).toHaveBeenCalledWith(1);
    expect(countPreparedNarration('Trang mộtnội dung mở đầu')).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await act(async () => undefined);
    await act(async () => undefined);

    expectPreparedNarration('Trang hainội dung tiếp theo');
  });

  it('does not restart narration when the visible page updates during playback', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));

    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('button', { name: /^trang tiếp theo$/i }));

    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await act(async () => undefined);

    expect(countPreparedNarration('Trang mộtnội dung mở đầu')).toBe(1);
  });

  it('lets the user choose narration voice and speed', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));

    const voiceTrigger = await screen.findByRole('button', { name: /^Giọng đọc\b/ });
    fireEvent.click(voiceTrigger);
    fireEvent.click(screen.getByRole('option', { name: /^Nam Minh\b/ }));

    const speedSlider = screen.getByLabelText('Tốc độ đọc');
    fireEvent.change(speedSlider, { target: { value: '25' } });

    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu', { rate: '+25%' }));
  });

  it('offers narration sleep timer presets only while narration is enabled', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));

    const sleepTimerTrigger = screen.getByRole('button', { name: /hẹn giờ dừng đọc/i });
    expect(sleepTimerTrigger).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(sleepTimerTrigger).toBeEnabled());
    fireEvent.click(sleepTimerTrigger);

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Tắt hẹn giờ',
      '5 phút',
      '10 phút',
      '15 phút',
      '30 phút',
      '45 phút',
      '60 phút',
    ]);

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));
    fireEvent.click(screen.getByRole('button', { name: /^dừng đọc$/i }));
    await waitFor(() => expect(sleepTimerTrigger).toBeDisabled());
  });

  it('counts down from an absolute sleep timer deadline and resets when a new preset is selected', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));
    await waitFor(() => expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument());

    vi.useFakeTimers();
    selectSleepTimer(/^30 phút$/i);
    expect(screen.getByLabelText('Thời gian đọc còn lại')).toHaveTextContent('30:00');

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('Thời gian đọc còn lại')).toHaveTextContent('29:59');

    selectSleepTimer(/^5 phút$/i);
    expect(screen.getByLabelText('Thời gian đọc còn lại')).toHaveTextContent('05:00');
  });

  it('removes the countdown without stopping active narration when the sleep timer is turned off', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));
    await waitFor(() => expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument());

    vi.useFakeTimers();
    selectSleepTimer(/^30 phút$/i);
    expect(screen.getByLabelText('Thời gian đọc còn lại')).toBeInTheDocument();

    selectSleepTimer(/^tắt hẹn giờ$/i);
    expect(screen.queryByLabelText('Thời gian đọc còn lại')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
  });

  it('preserves an active sleep timer when the setter receives an unsupported duration', async () => {
    const { result } = renderHook(() =>
      useInteractivePdfFlipbook({ title: 'Demo book', pdfPath: '/books/demo.pdf' }),
    );
    await waitFor(() => expect(result.current.isVoiceLoading).toBe(false));
    vi.useFakeTimers();

    act(() => result.current.setSleepTimerMinutes(30));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.sleepTimerMinutes).toBe(30);
    expect(result.current.sleepTimerRemainingSeconds).toBe(29 * 60 + 59);

    act(() => result.current.setSleepTimerMinutes(20));
    expect(result.current.sleepTimerMinutes).toBe(30);
    expect(result.current.sleepTimerRemainingSeconds).toBe(29 * 60 + 59);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.sleepTimerRemainingSeconds).toBe(29 * 60 + 58);
  });

  it('fully stops paused narration when the sleep timer expires', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    await screen.findByText('PDF page 1');
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
    vi.useFakeTimers();
    selectSleepTimer(/^5 phút$/i);
    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));
    expect(screen.getByRole('button', { name: /tiếp tục đọc/i })).toBeInTheDocument();
    pause.mockClear();
    load.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(screen.queryByRole('button', { name: /tiếp tục đọc/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^dừng đọc$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Thời gian đọc còn lại')).not.toBeInTheDocument();
    expect(pause).toHaveBeenCalled();
    expect(load).toHaveBeenCalled();
  });

  it('clears a paused pending page transition when the sleep timer expires', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    await screen.findByText('PDF page 1');
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
    await waitFor(() => expectPreparedNarration('Trang hainội dung tiếp theo'));
    prepareEdgeTtsAudioCacheFile.mockClear();

    vi.useFakeTimers();
    selectSleepTimer(/^5 phút$/i);
    act(() => {
      screen.getByLabelText('Âm thanh đọc văn bản').dispatchEvent(new Event('ended'));
    });
    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));
    const staleResumeButton = screen.getByRole('button', { name: /tiếp tục đọc/i });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    fireEvent.click(staleResumeButton);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500 + 650);
    });

    expect(flipTo).not.toHaveBeenCalledWith(1);
    expect(prepareEdgeTtsAudioCacheFile).not.toHaveBeenCalledWith(
      expect.objectContaining({ chunkText: 'Trang hainội dung tiếp theo' }),
    );
    expect(screen.queryByRole('button', { name: /tiếp tục đọc/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeInTheDocument();
  });

  it('passes narration volume from persisted settings without a neutral speech rate', async () => {
    window.localStorage.setItem(
      'interactivePdfFlipbook:narrationSettings:v1',
      JSON.stringify({
        selectedVoice: 'vi-VN-NamMinhNeural',
        speechRate: 0,
        speechVolume: 15,
      }),
    );

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu', { volume: '+15%' }));
  });

  it('disables the narration voice control while voices are loading', async () => {
    getVoices.mockImplementationOnce(() => new Promise(() => undefined));

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));

    expect(screen.getByRole('button', { name: /^Giọng đọc\b/ })).toBeDisabled();
  });

  it('shows when narration audio is being synthesized', async () => {
    let resolvePrepare: (result: { audioPath: string; audioUrl: string; cacheHit: boolean }) => void = () => undefined;
    prepareEdgeTtsAudioCacheFile.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolvePrepare = resolve;
      }),
    );

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    expect(await screen.findByRole('status', { name: /trạng thái đọc tự động/i })).toHaveTextContent(
      'Đang tạo giọng đọc...',
    );

    await act(async () => {
      resolvePrepare({ audioPath: 'C:\\Temp\\page-1.mp3', audioUrl: 'file:///C:/Temp/page-1.mp3', cacheHit: false });
    });

    await waitFor(() =>
      expect(screen.queryByRole('status', { name: /trạng thái đọc tự động/i })).not.toBeInTheDocument(),
    );
  });

  it('shows the loading bar while current page text is still being extracted', async () => {
    let resolvePage!: (page: { getTextContent: () => Promise<{ items: { str: string }[] }> }) => void;
    pdfJsMock.getPage.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);
    await screen.findByText('PDF page 1');

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    expect(screen.getByRole('status', { name: /trạng thái đọc tự động/i })).toHaveTextContent(
      'Đang tạo giọng đọc...',
    );
    expect(synthesize).not.toHaveBeenCalled();
    expect(writeExtractedText).not.toHaveBeenCalled();
    expect(readExtractedTextPage).not.toHaveBeenCalled();

    await act(async () => {
      resolvePage({
        getTextContent: async () => ({
          items: [{ str: 'Trang một' }, { str: 'nội dung mở đầu' }],
        }),
      });
    });

    await waitFor(() => expect(countPreparedNarration('Trang mộtnội dung mở đầu')).toBe(1));
  });

  it('retries PDF document loading after an initial narration extraction failure', async () => {
    pdfJsMock.getDocument.mockImplementationOnce(() => ({
      promise: Promise.reject(new Error('PDF document load failed')),
    }));

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);
    await screen.findByText('PDF page 1');

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    expect(await screen.findByText('PDF document load failed')).toBeInTheDocument();
    expect(synthesize).not.toHaveBeenCalled();
    expect(pdfJsMock.getDocument).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(pdfJsMock.getDocument).toHaveBeenCalledTimes(2));
    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));
  });

  it('resumes the pending page transition after pausing during the inter-page delay', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    vi.useFakeTimers();
    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    act(() => {
      narrationAudio.dispatchEvent(new Event('ended'));
    });

    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));

    await act(async () => {
      vi.advanceTimersByTime(1500 + 650);
    });
    await act(async () => undefined);

    expect(flipNext).not.toHaveBeenCalled();
    expect(countPreparedNarration('Trang mộtnội dung mở đầu')).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /tiếp tục đọc/i }));
    expect(play).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500 + 650);
    });
    await act(async () => undefined);

    expect(flipTo).toHaveBeenCalledWith(1);
    expectPreparedNarration('Trang hainội dung tiếp theo');
    expect(countPreparedNarration('Trang mộtnội dung mở đầu')).toBe(1);
    expect(countPreparedNarration('Trang hainội dung tiếp theo')).toBe(1);
    vi.useRealTimers();
  });

  it('continues narration when manual navigation occurs during the inter-page pause', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));

    vi.useFakeTimers();
    act(() => {
      screen.getByLabelText('Âm thanh đọc văn bản').dispatchEvent(new Event('ended'));
    });
    fireEvent.click(screen.getByRole('button', { name: /^trang tiếp theo$/i }));

    await act(async () => {
      vi.advanceTimersByTime(1500 + 650);
    });
    await act(async () => undefined);
    await act(async () => undefined);

    expectPreparedNarration('Trang hainội dung tiếp theo');
  });

  it('directly flips automatic narration to its next page when the visible page is far away', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/multi-page-demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));

    fireEvent.click(screen.getByRole('button', { name: /^trang cuối$/i }));
    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(5));
    flipTo.mockClear();

    vi.useFakeTimers();
    act(() => {
      screen.getByLabelText('Âm thanh đọc văn bản').dispatchEvent(new Event('ended'));
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(flipTo).toHaveBeenCalledWith(1);
    expect(countPreparedNarration('Trang mộtnội dung mở đầu')).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await act(async () => undefined);
    await act(async () => undefined);

    expectPreparedNarration('Trang hainội dung tiếp theo');
  });

  it('shows the auto-read bar as loading first, then playback controls after audio starts', async () => {
    let resolvePrepare: (result: { audioPath: string; audioUrl: string; cacheHit: boolean }) => void = () => undefined;
    prepareEdgeTtsAudioCacheFile.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolvePrepare = resolve;
      }),
    );

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    expect(await screen.findByRole('status', { name: /trạng thái đọc tự động/i })).toHaveTextContent(
      'Đang tạo giọng đọc...',
    );
    expect(screen.queryByRole('button', { name: /tạm dừng đọc/i })).not.toBeInTheDocument();

    await waitFor(() => expect(prepareEdgeTtsAudioCacheFile).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolvePrepare({ audioPath: 'C:\\Temp\\page-1.mp3', audioUrl: 'file:///C:/Temp/page-1.mp3', cacheHit: false });
    });

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc trang tiếp theo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc trang trước/i })).toBeDisabled();
    expect(screen.queryByText('Đang tạo giọng đọc...')).not.toBeInTheDocument();
  });

  it('pauses and resumes the current narration from the auto-read bar', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /tiếp tục đọc/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tiếp tục đọc/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument());
    expect(play).toHaveBeenCalledTimes(2);
    expect(countPreparedNarration('Trang mộtnội dung mở đầu')).toBe(1);
  });

  it('clears paused narration state when resuming playback fails', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    await screen.findByText('PDF page 1');
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));
    play.mockRejectedValueOnce(new Error('resume failed'));
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục đọc/i }));

    expect(await screen.findByText('Không thể phát Edge TTS.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tiếp tục đọc/i })).not.toBeInTheDocument();

    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    vi.useFakeTimers();
    fireEvent.ended(narrationAudio);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(flipTo).toHaveBeenCalledWith(1);
  });

  it('ignores a stale resume rejection after narration restarts', async () => {
    let rejectResume!: (reason?: unknown) => void;
    const deferredResume = new Promise<void>((_resolve, reject) => {
      rejectResume = reject;
    });

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    await screen.findByText('PDF page 1');
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));
    play.mockReturnValueOnce(deferredResume);
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục đọc/i }));

    fireEvent.click(screen.getByRole('button', { name: /^dừng đọc$/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    await act(async () => {
      rejectResume(new Error('stale resume failed'));
      await deferredResume.catch(() => undefined);
    });

    expect(screen.queryByText('Không thể phát Edge TTS.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
  });

  it('ignores a pending resume rejection after narration stops', async () => {
    let rejectResume!: (reason?: unknown) => void;
    const deferredResume = new Promise<void>((_resolve, reject) => {
      rejectResume = reject;
    });

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    await screen.findByText('PDF page 1');
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));
    play.mockReturnValueOnce(deferredResume);
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /^dừng đọc$/i }));

    await act(async () => {
      rejectResume(new Error('stale resume failed'));
      await deferredResume.catch(() => undefined);
    });

    expect(screen.queryByText('Không thể phát Edge TTS.')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /trạng thái đọc tự động/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeInTheDocument();
  });

  it('clears paused narration state after an audio error disables auto-read', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    await screen.findByText('PDF page 1');
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));

    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    fireEvent.error(narrationAudio);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    vi.useFakeTimers();
    fireEvent.ended(narrationAudio);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(flipTo).toHaveBeenCalledWith(1);
  });

  it('reads the next page when Next is clicked in the auto-read bar', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));

    fireEvent.click(await screen.findByRole('button', { name: /đọc trang tiếp theo/i }));

    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(1));
    await waitFor(() => expectPreparedNarration('Trang hainội dung tiếp theo'));
  });

  it('reads the previous page when Prev is clicked in the auto-read bar', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^trang tiếp theo$/i }));

    await waitFor(() => expect(flipNext).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByText((_content, element) =>
          Boolean(element?.classList.contains('interactive-reader__status') && element.textContent === 'Trang 2 / 2'),
        ),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang hainội dung tiếp theo'));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /đọc trang trước/i }));

    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(0));
    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));
  });

  it('directly flips to the next narration page when the visible page is far away', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/multi-page-demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expectPreparedNarration('Trang mộtnội dung mở đầu'));

    fireEvent.click(screen.getByRole('button', { name: /^trang cuối$/i }));

    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(5));
    await waitFor(() =>
      expect(
        screen.getByText((_content, element) =>
          Boolean(element?.classList.contains('interactive-reader__status') && element.textContent === 'Trang 6 / 6'),
        ),
      ).toBeInTheDocument(),
    );
    flipTo.mockClear();

    fireEvent.click(await screen.findByRole('button', { name: /đọc trang tiếp theo/i }));

    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(1));
    await waitFor(() => expectPreparedNarration('Trang hainội dung tiếp theo'));
  });

  it('removes invalid surrogate characters before narration', () => {
    expect(sanitizeNarrationText('Trang \udc9d một\n  nội dung')).toBe('Trang một nội dung');
  });
});
