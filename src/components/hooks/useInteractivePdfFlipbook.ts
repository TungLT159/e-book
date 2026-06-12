import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { getDocument } from 'pdfjs-dist';
import { resolvePublicAssetPath } from '../../utils/publicAsset';
import {
  sanitizeNarrationText,
  textContentItemsToNarrationText,
  type PdfTextContentItem,
} from '../../utils/narration';
import { createNarrationPreparationCoordinator } from '../../utils/narrationPreparation';
import type { ReadingProgressRecord } from '../../types/electron';

const PDF_PAGE_WIDTH = 660;
const PDF_PAGE_HEIGHT = 720;
const FULLSCREEN_PDF_PAGE_WIDTH = 980;
const FULLSCREEN_PDF_PAGE_HEIGHT = 840;
const FULLSCREEN_PDF_MAX_WIDTH = 1200;
const FULLSCREEN_PDF_MAX_HEIGHT = 960;
const FULLSCREEN_HORIZONTAL_MARGIN = 96;
const FULLSCREEN_VERTICAL_MARGIN = 180;
const READER_VERTICAL_CHROME = 152;
const FLIPPING_TIME = 650;
const PAGE_FLIP_SOUND_PATH = '/Audio/effects/page-flip.mp3';
const NARRATION_VOICE = 'vi-VN-NamMinhNeural';
const DEFAULT_NARRATION_RATE = 0;
const DEFAULT_NARRATION_VOLUME = 0;
const NARRATION_SETTINGS_STORAGE_KEY = 'interactivePdfFlipbook:narrationSettings:v1';
const NARRATION_PRELOAD_LOOKAHEAD = 1;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 1.35;
const ZOOM_STEP = 0.1;
const FULLSCREEN_ZOOM_MULTIPLIER = 1.18;
const AUTO_FLIP_INTERVAL = 3200;
const NARRATION_PAGE_PAUSE_MS = 1500;

function markNarrationPerformance(name: string) {
  if (!import.meta.env.DEV) return;

  try {
    globalThis.performance?.mark?.(name);
  } catch {
    // Development instrumentation is best-effort and must not affect narration.
  }
}

function measureNarrationPerformance(name: string, startMark: string, endMark: string) {
  if (!import.meta.env.DEV) return;

  try {
    globalThis.performance?.measure?.(name, startMark, endMark);
  } catch {
    // Development instrumentation is best-effort and must not affect narration.
  }
}

function measureNarrationDuration(name: string, duration: number | undefined) {
  if (!import.meta.env.DEV || typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) return;

  try {
    globalThis.performance?.measure?.(name, { start: 0, duration });
  } catch {
    // Development instrumentation is best-effort and must not affect narration.
  }
}

type PageFlipApi = {
  flipNext: () => void;
  flipPrev: () => void;
  flip: (pageIndex: number) => void;
  update?: () => void;
};

type PageFlipRef = {
  pageFlip: () => PageFlipApi;
};

type NarrationVoiceOption = {
  value: string;
  label: string;
};

type EdgeTtsVoice = {
  ShortName?: string;
  FriendlyName?: string;
  Locale?: string;
  Name?: string;
};

type NarrationSettings = {
  selectedVoice: string;
  speechRate: number;
  speechVolume: number;
};

type PdfDocumentProxy = Awaited<ReturnType<typeof getDocument>['promise']>;

type NarrationPreparationRequest = {
  bookKey: string;
  voice: string;
  rate: string;
  volume: string;
  chunkIndex: number;
  chunkText: string;
};

type NarrationPreparationResult = {
  audioPath: string;
  audioUrl: string;
  cacheHit: boolean;
  timings?: {
    cacheLookupMs: number;
    synthesisMs: number;
  };
};

type ViewportSize = {
  width: number;
  height: number;
};

type UseInteractivePdfFlipbookProps = {
  title: string;
  pdfPath: string;
  bookId?: string;
  savedProgress?: ReadingProgressRecord | null;
  isReadingProgressLoaded?: boolean;
  onProgressChange?: (payload: ReadingProgressRecord) => void;
};

type UseInteractivePdfFlipbookResult = {
  numPages: number;
  currentPageIndex: number;
  currentPage: number;
  pdfError: string | null;
  isMenuOpen: boolean;
  isTtsSettingsOpen: boolean;
  zoom: number;
  isFullscreen: boolean;
  viewportSize: ViewportSize;
  isAutoFlipEnabled: boolean;
  isThumbnailPanelOpen: boolean;
  isNarrationEnabled: boolean;
  narrationPageIndex: number;
  isNarrationLoading: boolean;
  isNarrationSynthesizing: boolean;
  isNarrationPaused: boolean;
  isVoiceLoading: boolean;
  voiceOptions: NarrationVoiceOption[];
  selectedVoice: string;
  speechRate: number;
  speechVolume: number;
  sleepTimerMinutes: number | null;
  sleepTimerRemainingSeconds: number | null;
  narrationError: string | null;
  setNumPages: Dispatch<SetStateAction<number>>;
  setPdfError: Dispatch<SetStateAction<string | null>>;
  pages: number[];
  resolvedPdfPath: string;
  resolvedPageFlipSoundPath: string;
  readerZoom: number;
  bookWidth: number;
  bookHeight: number;
  bookMaxWidth: number;
  bookMaxHeight: number;
  isAutoReadPreparing: boolean;
  readerRef: RefObject<HTMLElement | null>;
  menuToggleRef: RefObject<HTMLButtonElement | null>;
  menuPanelRef: RefObject<HTMLElement | null>;
  bookRef: RefObject<PageFlipRef | null>;
  pageFlipAudioRef: RefObject<HTMLAudioElement | null>;
  narrationAudioRef: RefObject<HTMLAudioElement | null>;
  setIsAutoFlipEnabled: Dispatch<SetStateAction<boolean>>;
  setIsThumbnailPanelOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedVoice: Dispatch<SetStateAction<string>>;
  setSpeechRate: Dispatch<SetStateAction<number>>;
  setSpeechVolume: Dispatch<SetStateAction<number>>;
  setSleepTimerMinutes: (minutes: number | null) => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  toggleTtsSettings: () => void;
  closeTtsSettings: () => void;
  changeZoom: (direction: 1 | -1) => void;
  toggleFullscreen: () => void;
  toggleThumbnails: () => void;
  toggleNarration: () => void;
  toggleNarrationPlayback: () => void;
  flipToPage: (pageIndex: number) => void;
  flipToPreviousPage: () => void;
  flipToNextPage: () => void;
  readNarrationPage: (pageIndex: number) => void;
  handleFlip: (event: { data: number }) => void;
  onFlipbookInit: () => void;
};

function clampNarrationPercentage(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;

  const steppedValue = Math.round(value / 5) * 5;
  return Math.min(50, Math.max(-50, steppedValue));
}

function readStoredNarrationSettings(): NarrationSettings {
  const defaults = {
    selectedVoice: NARRATION_VOICE,
    speechRate: DEFAULT_NARRATION_RATE,
    speechVolume: DEFAULT_NARRATION_VOLUME,
  };

  try {
    const rawSettings = window.localStorage.getItem(NARRATION_SETTINGS_STORAGE_KEY);
    if (!rawSettings) return defaults;

    const parsedSettings = JSON.parse(rawSettings) as Partial<NarrationSettings>;
    return {
      selectedVoice:
        typeof parsedSettings.selectedVoice === 'string' && parsedSettings.selectedVoice.trim()
          ? parsedSettings.selectedVoice
          : defaults.selectedVoice,
      speechRate: clampNarrationPercentage(parsedSettings.speechRate, defaults.speechRate),
      speechVolume: clampNarrationPercentage(parsedSettings.speechVolume, defaults.speechVolume),
    };
  } catch {
    return defaults;
  }
}

function writeStoredNarrationSettings(settings: NarrationSettings) {
  try {
    window.localStorage.setItem(NARRATION_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Preference persistence should never block reading.
  }
}

export function useInteractivePdfFlipbook({
  title,
  pdfPath,
  bookId,
  savedProgress,
  isReadingProgressLoaded = true,
  onProgressChange,
}: UseInteractivePdfFlipbookProps): UseInteractivePdfFlipbookResult {
  const [initialNarrationSettings] = useState(readStoredNarrationSettings);
  const [numPages, setNumPages] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTtsSettingsOpen, setIsTtsSettingsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportSize, setViewportSize] = useState<ViewportSize>(() => ({
    width: window.innerWidth || document.documentElement.clientWidth || 0,
    height: window.innerHeight || document.documentElement.clientHeight || 0,
  }));
  const [isAutoFlipEnabled, setIsAutoFlipEnabled] = useState(false);
  const [isThumbnailPanelOpen, setIsThumbnailPanelOpen] = useState(false);
  const [isNarrationEnabled, setIsNarrationEnabled] = useState(false);
  const [narrationPageIndex, setNarrationPageIndex] = useState(0);
  const [isNarrationLoading, setIsNarrationLoading] = useState(false);
  const [isNarrationSynthesizing, setIsNarrationSynthesizing] = useState(false);
  const [isNarrationPaused, setIsNarrationPaused] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceOptions, setVoiceOptions] = useState<NarrationVoiceOption[]>([
    { value: NARRATION_VOICE, label: 'Hoài My (vi-VN)' },
  ]);
  const [selectedVoice, setSelectedVoice] = useState(initialNarrationSettings.selectedVoice);
  const [speechRate, setSpeechRateState] = useState(initialNarrationSettings.speechRate);
  const [speechVolume, setSpeechVolumeState] = useState(initialNarrationSettings.speechVolume);
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<number | null>(null);
  const [sleepTimerRemainingSeconds, setSleepTimerRemainingSeconds] = useState<number | null>(null);
  const [narrationError, setNarrationError] = useState<string | null>(null);
  const readerRef = useRef<HTMLElement | null>(null);
  const menuToggleRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLElement | null>(null);
  const bookRef = useRef<PageFlipRef | null>(null);
  const pageFlipAudioRef = useRef<HTMLAudioElement | null>(null);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentPageIndexRef = useRef(0);
  const lastSyncedPageRef = useRef(1);
  const flipSettledTimeoutRef = useRef<number | null>(null);
  const restoredProgressIdentityRef = useRef<string | null>(null);
  const isRestoringProgressRef = useRef(false);
  const lastEmittedPageIndexRef = useRef<number | null>(null);
  const emittedOpenProgressKeysRef = useRef(new Set<string>());
  const pendingRestoreRef = useRef<number | null>(null);
  const narrationBlobUrlRef = useRef<string | null>(null);
  const narrationRequestIdRef = useRef(0);
  const narrationPlaybackOperationIdRef = useRef(0);
  const narrationPreloadRequestIdRef = useRef(0);
  const narrationPagePauseTimeoutRef = useRef<number | null>(null);
  const sleepTimerDeadlineRef = useRef<number | null>(null);
  const sleepTimerDisplayIntervalRef = useRef<number | null>(null);
  const sleepTimerExpiryTimeoutRef = useRef<number | null>(null);
  const pendingNarrationPageIndexRef = useRef<number | null>(null);
  const isNarrationPausedRef = useRef(false);
  const narrationStartupTimingOperationIdRef = useRef(0);
  const pendingNarrationStartupTimingIdRef = useRef<number | null>(null);
  const pdfDocumentCacheRef = useRef<{ path: string; promise: Promise<PdfDocumentProxy> } | null>(null);
  const pageNarrationTextPromisesRef = useRef(new Map<number, Promise<string>>());
  const createNarrationPreparationGeneration = () => {
    const requests = new Map<string, NarrationPreparationRequest>();
    const results = new Map<string, {
      promise: Promise<NarrationPreparationResult>;
      pendingBackgroundPromotion: boolean;
    }>();
    const coordinator = createNarrationPreparationCoordinator<NarrationPreparationResult>({
      backgroundConcurrency: 2,
      prepare: (key) => {
        const request = requests.get(key);
        if (!request) {
          throw new Error('Narration preparation request is unavailable.');
        }

        return window.audioCache!.prepareEdgeTtsAudioCacheFile(request);
      },
    });

    return { requests, results, coordinator };
  };
  const narrationPreparationGenerationRef = useRef(createNarrationPreparationGeneration());

  const currentPage = currentPageIndex + 1;
  const pages = Array.from({ length: numPages }, (_, index) => index + 1);
  const resolvedPdfPath = resolvePublicAssetPath(pdfPath);
  const activeProgressIdentity = `${bookId || 'pdf'}:${pdfPath}`;
  const restorableProgress =
    savedProgress && (!bookId || savedProgress.bookId === bookId)
      ? savedProgress
      : null;
  const resolvedPageFlipSoundPath = resolvePublicAssetPath(PAGE_FLIP_SOUND_PATH);
  const readerZoom = zoom * (isFullscreen ? FULLSCREEN_ZOOM_MULTIPLIER : 1);
  const fullscreenAvailableWidth = Math.max(
    FULLSCREEN_PDF_MAX_WIDTH,
    viewportSize.width - FULLSCREEN_HORIZONTAL_MARGIN,
  );
  const fullscreenAvailableHeight = Math.max(
    FULLSCREEN_PDF_MAX_HEIGHT,
    viewportSize.height - FULLSCREEN_VERTICAL_MARGIN,
  );
  const normalAvailableHeight = Math.max(
    PDF_PAGE_HEIGHT,
    viewportSize.height - READER_VERTICAL_CHROME,
  );
  const bookWidth = isFullscreen ? FULLSCREEN_PDF_PAGE_WIDTH : PDF_PAGE_WIDTH;
  const bookHeight = isFullscreen
    ? Math.max(FULLSCREEN_PDF_PAGE_HEIGHT, fullscreenAvailableHeight)
    : normalAvailableHeight;
  const bookMaxWidth = isFullscreen ? fullscreenAvailableWidth : PDF_PAGE_WIDTH;
  const bookMaxHeight = isFullscreen ? fullscreenAvailableHeight : normalAvailableHeight;
  const isAutoReadPreparing = isNarrationLoading || isNarrationSynthesizing;

  useEffect(() => {
    isNarrationPausedRef.current = isNarrationPaused;
  }, [isNarrationPaused]);

  const setSpeechRate: Dispatch<SetStateAction<number>> = useCallback((value) => {
    setSpeechRateState((currentValue) =>
      clampNarrationPercentage(
        typeof value === 'function' ? value(currentValue) : value,
        currentValue,
      ),
    );
  }, []);

  const setSpeechVolume: Dispatch<SetStateAction<number>> = useCallback((value) => {
    setSpeechVolumeState((currentValue) =>
      clampNarrationPercentage(
        typeof value === 'function' ? value(currentValue) : value,
        currentValue,
      ),
    );
  }, []);

  const clearSleepTimer = useCallback(() => {
    if (sleepTimerDisplayIntervalRef.current !== null) {
      window.clearInterval(sleepTimerDisplayIntervalRef.current);
      sleepTimerDisplayIntervalRef.current = null;
    }
    if (sleepTimerExpiryTimeoutRef.current !== null) {
      window.clearTimeout(sleepTimerExpiryTimeoutRef.current);
      sleepTimerExpiryTimeoutRef.current = null;
    }
    sleepTimerDeadlineRef.current = null;
    setSleepTimerMinutesState(null);
    setSleepTimerRemainingSeconds(null);
  }, []);

  const setSleepTimerMinutes = useCallback((minutes: number | null) => {
    if (minutes !== null && ![5, 10, 15, 30, 45, 60].includes(minutes)) return;
    clearSleepTimer();
    if (minutes === null) return;

    const durationMs = minutes * 60 * 1000;
    const deadline = Date.now() + durationMs;
    sleepTimerDeadlineRef.current = deadline;
    setSleepTimerMinutesState(minutes);
    setSleepTimerRemainingSeconds(minutes * 60);

    sleepTimerDisplayIntervalRef.current = window.setInterval(() => {
      if (sleepTimerDeadlineRef.current !== deadline) return;
      setSleepTimerRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 1000);

    sleepTimerExpiryTimeoutRef.current = window.setTimeout(() => {
      if (sleepTimerDeadlineRef.current !== deadline) return;
      clearSleepTimer();
      setIsNarrationEnabled(false);
    }, durationMs);
  }, [clearSleepTimer]);

  useEffect(() => clearSleepTimer, [clearSleepTimer]);

  useEffect(() => {
    writeStoredNarrationSettings({ selectedVoice, speechRate, speechVolume });
    narrationPreparationGenerationRef.current = createNarrationPreparationGeneration();
  }, [selectedVoice, speechRate, speechVolume]);

  useEffect(() => {
    narrationPreparationGenerationRef.current = createNarrationPreparationGeneration();
  }, [pdfPath, title]);

  const formatNarrationPercentage = useCallback((percentage: number) => {
    if (percentage === 0) return undefined;
    return `${percentage > 0 ? '+' : ''}${percentage}%`;
  }, []);

  const buildNarrationPreparationKey = useCallback(
    (pageIndex: number, chunkText: string, voice: string, rate: string, volume: string) =>
      JSON.stringify({ title, page: pageIndex, text: chunkText, voice, rate, volume }),
    [title],
  );

  const registerNarrationPreparationRequest = useCallback(
    (pageIndex: number, chunkText: string, voice: string, rate: string, volume: string) => {
      const key = buildNarrationPreparationKey(pageIndex, chunkText, voice, rate, volume);
      narrationPreparationGenerationRef.current.requests.set(key, {
        bookKey: title,
        voice,
        rate,
        volume,
        chunkIndex: pageIndex,
        chunkText,
      });
      return key;
    },
    [buildNarrationPreparationKey, title],
  );

  const prepareNarrationForeground = useCallback((key: string) => {
    const generation = narrationPreparationGenerationRef.current;
    const existingPreparation = generation.results.get(key);
    if (existingPreparation) {
      if (existingPreparation.pendingBackgroundPromotion) {
        existingPreparation.pendingBackgroundPromotion = false;
        void generation.coordinator.prepareForeground(key);
      }
      return existingPreparation.promise;
    }

    const preparation = generation.coordinator.prepareForeground(key).catch((error) => {
      generation.results.delete(key);
      throw error;
    });
    generation.results.set(key, { promise: preparation, pendingBackgroundPromotion: false });
    return preparation;
  }, []);

  const prepareNarrationBackground = useCallback((key: string) => {
    const generation = narrationPreparationGenerationRef.current;
    const existingPreparation = generation.results.get(key);
    if (existingPreparation) return existingPreparation.promise;

    const entry = { promise: Promise.resolve(null as never) as Promise<NarrationPreparationResult>, pendingBackgroundPromotion: true };
    const preparation = generation.coordinator.prepareBackground(key).then(
      (result) => {
        entry.pendingBackgroundPromotion = false;
        return result;
      },
      (error) => {
        generation.results.delete(key);
        throw error;
      },
    );
    entry.promise = preparation;
    generation.results.set(key, entry);
    return preparation;
  }, []);

  const isPageVisibleInCurrentSpread = useCallback((pageIndex: number) => {
    const currentVisiblePageIndex = currentPageIndexRef.current;

    if (pageIndex === currentVisiblePageIndex) return true;

    return currentVisiblePageIndex > 0 && pageIndex === currentVisiblePageIndex + 1;
  }, []);

  const playPageFlipSound = useCallback(() => {
    const sound = pageFlipAudioRef.current;
    if (!sound) return;

    sound.currentTime = 0;
    void sound.play().catch(() => undefined);
  }, []);

  const stopNarration = useCallback(() => {
    narrationRequestIdRef.current += 1;
    narrationPlaybackOperationIdRef.current += 1;
    narrationPreloadRequestIdRef.current += 1;
    pendingNarrationPageIndexRef.current = null;

    if (narrationPagePauseTimeoutRef.current !== null) {
      window.clearTimeout(narrationPagePauseTimeoutRef.current);
      narrationPagePauseTimeoutRef.current = null;
    }

    const audio = narrationAudioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    if (narrationBlobUrlRef.current) {
      URL.revokeObjectURL(narrationBlobUrlRef.current);
      narrationBlobUrlRef.current = null;
    }

    setIsNarrationPaused(false);
    setIsNarrationSynthesizing(false);
  }, []);

  const destroyPdfDocumentCache = useCallback(
    (cachedDocument: { path: string; promise: Promise<PdfDocumentProxy> } | null) => {
      if (!cachedDocument) return;

      if (pdfDocumentCacheRef.current === cachedDocument) {
        pdfDocumentCacheRef.current = null;
      }

      void cachedDocument.promise
        .then((pdf) => {
          void pdf.destroy?.();
        })
        .catch(() => undefined);
    },
    [],
  );

  const getPdfDocument = useCallback(() => {
    const cachedDocument = pdfDocumentCacheRef.current;
    if (cachedDocument?.path === resolvedPdfPath) {
      return cachedDocument.promise;
    }

    destroyPdfDocumentCache(cachedDocument);

    const nextCachedDocument: { path: string; promise: Promise<PdfDocumentProxy> } = {
      path: resolvedPdfPath,
      promise: getDocument({ url: resolvedPdfPath }).promise.catch((error) => {
        if (pdfDocumentCacheRef.current === nextCachedDocument) {
          pdfDocumentCacheRef.current = null;
        }
        throw error;
      }),
    };

    pdfDocumentCacheRef.current = nextCachedDocument;
    pageNarrationTextPromisesRef.current.clear();
    return nextCachedDocument.promise;
  }, [destroyPdfDocumentCache, resolvedPdfPath]);

  const getNarrationText = useCallback(
    (pageIndex: number) => {
      const cachedTextPromise = pageNarrationTextPromisesRef.current.get(pageIndex);
      if (cachedTextPromise) {
        return cachedTextPromise;
      }

      const textPromise = (async () => {
        const pdf = await getPdfDocument();
        const page = await pdf.getPage(pageIndex + 1);
        const textContent = await page.getTextContent();
        const pageText = textContentItemsToNarrationText(textContent.items as PdfTextContentItem[]);
        return sanitizeNarrationText(pageText);
      })().catch((error) => {
        pageNarrationTextPromisesRef.current.delete(pageIndex);
        throw error;
      });

      pageNarrationTextPromisesRef.current.set(pageIndex, textPromise);
      return textPromise;
    },
    [getPdfDocument],
  );

  const preloadNextNarrationPage = useCallback(
    (
      pageIndex: number,
      narrationOptions: { voice: string; rate?: string; volume?: string },
      narrationRequestId: number,
    ) => {
      const lookaheadPageIndexes = [
        pageIndex + NARRATION_PRELOAD_LOOKAHEAD,
        pageIndex + NARRATION_PRELOAD_LOOKAHEAD + 1,
      ];
      const preloadRequestId = narrationPreloadRequestIdRef.current;

      lookaheadPageIndexes.forEach((nextPageIndex) => {
        if (nextPageIndex >= numPages) return;

        void (async () => {
          try {
            const chunkText = await getNarrationText(nextPageIndex);
            if (
              preloadRequestId !== narrationPreloadRequestIdRef.current ||
              narrationRequestId !== narrationRequestIdRef.current
            ) {
              return;
            }

            if (!chunkText) {
              return;
            }

            const key = registerNarrationPreparationRequest(
              nextPageIndex,
              chunkText,
              narrationOptions.voice,
              narrationOptions.rate || '',
              narrationOptions.volume || '',
            );
            void prepareNarrationBackground(key).catch(() => undefined);
          } catch {
            // Preload is best-effort; current narration should continue unaffected.
          }
        })();
      });
    },
    [getNarrationText, numPages, prepareNarrationBackground, registerNarrationPreparationRequest],
  );

  const toggleNarration = useCallback(() => {
    setNarrationError(null);

    if (isNarrationEnabled) {
      narrationRequestIdRef.current += 1;
      narrationPlaybackOperationIdRef.current += 1;
      narrationPreloadRequestIdRef.current += 1;
      pendingNarrationPageIndexRef.current = null;
      setIsNarrationEnabled(false);
      isNarrationPausedRef.current = false;
      setIsNarrationPaused(false);
      return;
    }

    const startupTimingId = ++narrationStartupTimingOperationIdRef.current;
    pendingNarrationStartupTimingIdRef.current = startupTimingId;
    markNarrationPerformance(`narration-start:${startupTimingId}`);
    setIsNarrationLoading(false);
    setIsNarrationSynthesizing(true);
    setNarrationPageIndex(currentPageIndex);
    setIsNarrationEnabled(true);
  }, [currentPageIndex, isNarrationEnabled]);

  const continuePendingNarrationTransition = useCallback(
    (targetPageIndex: number, requestId: number) => {
      narrationPagePauseTimeoutRef.current = window.setTimeout(() => {
        narrationPagePauseTimeoutRef.current = null;
        if (
          requestId !== narrationRequestIdRef.current ||
          isNarrationPausedRef.current ||
          pendingNarrationPageIndexRef.current !== targetPageIndex
        ) return;

        if (isPageVisibleInCurrentSpread(targetPageIndex)) {
          pendingNarrationPageIndexRef.current = null;
          setNarrationPageIndex(targetPageIndex);
          return;
        }

        bookRef.current?.pageFlip()?.flip(targetPageIndex);
        narrationPagePauseTimeoutRef.current = window.setTimeout(() => {
          narrationPagePauseTimeoutRef.current = null;
          if (
            requestId !== narrationRequestIdRef.current ||
            isNarrationPausedRef.current ||
            pendingNarrationPageIndexRef.current !== targetPageIndex
          ) return;

          pendingNarrationPageIndexRef.current = null;
          setNarrationPageIndex(targetPageIndex);
        }, FLIPPING_TIME);
      }, NARRATION_PAGE_PAUSE_MS);
    },
    [isPageVisibleInCurrentSpread],
  );

  const toggleNarrationPlayback = useCallback(() => {
    const audio = narrationAudioRef.current;
    if (!audio || isAutoReadPreparing) return;

    if (isNarrationPaused) {
      const pendingPageIndex = pendingNarrationPageIndexRef.current;
      if (pendingPageIndex !== null) {
        isNarrationPausedRef.current = false;
        setIsNarrationPaused(false);
        continuePendingNarrationTransition(pendingPageIndex, narrationRequestIdRef.current);
        return;
      }

      const playbackOperationId = ++narrationPlaybackOperationIdRef.current;
      void audio
        .play()
        .then(() => {
          if (playbackOperationId !== narrationPlaybackOperationIdRef.current) return;
          isNarrationPausedRef.current = false;
          setIsNarrationPaused(false);
        })
        .catch(() => {
          if (playbackOperationId !== narrationPlaybackOperationIdRef.current) return;
          setNarrationError('Không thể phát Edge TTS.');
          isNarrationPausedRef.current = false;
          setIsNarrationPaused(false);
          setIsNarrationEnabled(false);
        });
      return;
    }

    if (narrationPagePauseTimeoutRef.current !== null) {
      window.clearTimeout(narrationPagePauseTimeoutRef.current);
      narrationPagePauseTimeoutRef.current = null;
    }

    audio.pause();
    isNarrationPausedRef.current = true;
    setIsNarrationPaused(true);
  }, [continuePendingNarrationTransition, isAutoReadPreparing, isNarrationPaused]);

  const setVisiblePage = useCallback((pageIndex: number) => {
    const nextPage = pageIndex + 1;
    currentPageIndexRef.current = pageIndex;
    lastSyncedPageRef.current = nextPage;
    setCurrentPageIndex(pageIndex);
  }, []);

  const onFlipbookInit = useCallback(() => {
    const pendingPage = pendingRestoreRef.current;
    if (pendingPage !== null) {
      pendingRestoreRef.current = null;
      bookRef.current?.pageFlip()?.flip(pendingPage);
    }
  }, []);

  const emitProgress = useCallback(
    (pageIndex: number) => {
      const progressBookId = bookId || savedProgress?.bookId;
      if (!progressBookId || !onProgressChange || !numPages) return;

      lastEmittedPageIndexRef.current = pageIndex;
      onProgressChange({
        bookId: progressBookId,
        lastPageIndex: pageIndex,
        progressPercent: Math.round(((pageIndex + 1) / numPages) * 100),
        completed: pageIndex === numPages - 1,
        lastOpenedAt: new Date().toISOString(),
      });
    },
    [bookId, numPages, onProgressChange, savedProgress?.bookId],
  );

  const handleFlip = useCallback(
    (event: { data: number }) => {
      playPageFlipSound();

      if (isRestoringProgressRef.current) {
        isRestoringProgressRef.current = false;
        return;
      }

      if (flipSettledTimeoutRef.current !== null) {
        window.clearTimeout(flipSettledTimeoutRef.current);
      }

      flipSettledTimeoutRef.current = window.setTimeout(() => {
        const settledPageIndex = Math.min(Math.max(event.data, 0), numPages - 1);
        setVisiblePage(settledPageIndex);
        if (lastEmittedPageIndexRef.current !== settledPageIndex) {
          emitProgress(settledPageIndex);
        }
        flipSettledTimeoutRef.current = null;
      }, FLIPPING_TIME);
    },
    [emitProgress, numPages, playPageFlipSound, setVisiblePage],
  );

  const flipToPage = useCallback(
    (pageIndex: number) => {
      if (!numPages) return;

      const targetPageIndex = Math.min(Math.max(pageIndex, 0), numPages - 1);
      bookRef.current?.pageFlip()?.flip(targetPageIndex);
      setVisiblePage(targetPageIndex);
      setIsThumbnailPanelOpen(false);
    },
    [numPages, setVisiblePage],
  );

  const flipToPreviousPage = useCallback(() => {
    if (currentPageIndex <= 0) return;

    bookRef.current?.pageFlip()?.flipPrev();
  }, [currentPageIndex]);

  const flipToNextPage = useCallback(() => {
    if (!numPages || currentPageIndexRef.current >= numPages - 1) return;

    bookRef.current?.pageFlip()?.flipNext();
  }, [numPages]);

  const readNarrationPage = useCallback(
    (targetPageIndex: number) => {
      if (!numPages || targetPageIndex < 0 || targetPageIndex >= numPages) return;

      const requestId = ++narrationRequestIdRef.current;
      narrationPlaybackOperationIdRef.current += 1;
      narrationPreloadRequestIdRef.current += 1;
      pendingNarrationPageIndexRef.current = null;

      if (narrationPagePauseTimeoutRef.current !== null) {
        window.clearTimeout(narrationPagePauseTimeoutRef.current);
        narrationPagePauseTimeoutRef.current = null;
      }

      const audio = narrationAudioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }

      if (narrationBlobUrlRef.current) {
        URL.revokeObjectURL(narrationBlobUrlRef.current);
        narrationBlobUrlRef.current = null;
      }

      setNarrationError(null);
      isNarrationPausedRef.current = false;
      setIsNarrationPaused(false);
      setIsNarrationSynthesizing(false);

      if (isPageVisibleInCurrentSpread(targetPageIndex)) {
        setNarrationPageIndex(targetPageIndex);
        return;
      }

      bookRef.current?.pageFlip()?.flip(targetPageIndex);

      narrationPagePauseTimeoutRef.current = window.setTimeout(() => {
        narrationPagePauseTimeoutRef.current = null;
        if (requestId !== narrationRequestIdRef.current) return;

        setNarrationPageIndex(targetPageIndex);
      }, FLIPPING_TIME);
    },
    [isPageVisibleInCurrentSpread, numPages],
  );

  const changeZoom = useCallback((direction: 1 | -1) => {
    setZoom((currentZoom) => {
      const nextZoom = currentZoom + direction * ZOOM_STEP;
      return Math.min(Math.max(Number(nextZoom.toFixed(2)), MIN_ZOOM), MAX_ZOOM);
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    const reader = readerRef.current;
    if (!reader) return;

    if (document.fullscreenElement) {
      const exitFullscreen = document.exitFullscreen?.();
      void exitFullscreen?.catch(() => undefined);
      return;
    }

    const requestFullscreen = reader.requestFullscreen?.();
    void requestFullscreen?.catch(() => undefined);
  }, []);

  const toggleThumbnails = useCallback(() => {
    setIsThumbnailPanelOpen((isOpen) => {
      const nextIsOpen = !isOpen;

      if (nextIsOpen) {
        setIsMenuOpen(false);
        setIsTtsSettingsOpen(false);
      }

      return nextIsOpen;
    });
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    setIsTtsSettingsOpen(false);
    setIsThumbnailPanelOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => {
      if (prev) {
        setIsTtsSettingsOpen(false);
        setIsThumbnailPanelOpen(false);
      }
      return !prev;
    });
  }, []);

  const toggleTtsSettings = useCallback(() => {
    setIsTtsSettingsOpen((prev) => !prev);
  }, []);

  const closeTtsSettings = useCallback(() => {
    setIsTtsSettingsOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (flipSettledTimeoutRef.current !== null) {
        window.clearTimeout(flipSettledTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (flipSettledTimeoutRef.current !== null) {
      window.clearTimeout(flipSettledTimeoutRef.current);
      flipSettledTimeoutRef.current = null;
    }

    lastSyncedPageRef.current = 1;
    currentPageIndexRef.current = 0;
    isRestoringProgressRef.current = false;
    setCurrentPageIndex(0);

    return () => {
      narrationStartupTimingOperationIdRef.current += 1;
      pendingNarrationStartupTimingIdRef.current = null;
    };
  }, [pdfPath, title]);

  useEffect(() => {
    if (flipSettledTimeoutRef.current !== null) {
      window.clearTimeout(flipSettledTimeoutRef.current);
      flipSettledTimeoutRef.current = null;
    }

    restoredProgressIdentityRef.current = null;
    isRestoringProgressRef.current = false;
    lastEmittedPageIndexRef.current = null;
    currentPageIndexRef.current = 0;
    setCurrentPageIndex(0);
  }, [activeProgressIdentity]);

  useEffect(() => {
    return () => {
      if (flipSettledTimeoutRef.current !== null) {
        window.clearTimeout(flipSettledTimeoutRef.current);
        flipSettledTimeoutRef.current = null;
      }
    };
  }, [activeProgressIdentity, onProgressChange]);

  useEffect(() => {
    if (
      !numPages ||
      !restorableProgress ||
      restoredProgressIdentityRef.current === activeProgressIdentity
    ) return;

    const restoredPageIndex = Math.min(Math.max(restorableProgress.lastPageIndex, 0), numPages - 1);
    restoredProgressIdentityRef.current = activeProgressIdentity;
    const restoredOpenKey = `${activeProgressIdentity}:restored`;
    const shouldEmitRestoredOpen =
      !emittedOpenProgressKeysRef.current.has(restoredOpenKey) &&
      lastEmittedPageIndexRef.current !== restoredPageIndex;
    if (shouldEmitRestoredOpen) {
      emittedOpenProgressKeysRef.current.add(restoredOpenKey);
    }

    if (restoredPageIndex === currentPageIndexRef.current) {
      if (shouldEmitRestoredOpen) emitProgress(restoredPageIndex);
      return;
    }

    const flipApi = bookRef.current?.pageFlip();
    if (flipApi) {
      isRestoringProgressRef.current = true;
      flipApi.flip(restoredPageIndex);
      setVisiblePage(restoredPageIndex);
      if (shouldEmitRestoredOpen) emitProgress(restoredPageIndex);
    } else {
      pendingRestoreRef.current = restoredPageIndex;
    }
  }, [activeProgressIdentity, emitProgress, numPages, restorableProgress, setVisiblePage]);

  useEffect(() => {
    if (!numPages || restorableProgress || !isReadingProgressLoaded) return;

    const initialOpenKey = `${activeProgressIdentity}:initial`;
    if (emittedOpenProgressKeysRef.current.has(initialOpenKey)) return;

    emittedOpenProgressKeysRef.current.add(initialOpenKey);
    emitProgress(0);
  }, [activeProgressIdentity, emitProgress, isReadingProgressLoaded, numPages, restorableProgress]);

  useEffect(() => {
    destroyPdfDocumentCache(pdfDocumentCacheRef.current);
    pageNarrationTextPromisesRef.current.clear();
    setNarrationError(null);
    setIsNarrationLoading(false);
    setIsNarrationEnabled(false);
    stopNarration();

    return () => {
      destroyPdfDocumentCache(pdfDocumentCacheRef.current);
    };
  }, [destroyPdfDocumentCache, resolvedPdfPath, stopNarration]);

  useEffect(() => {
    let cancelled = false;

    setIsVoiceLoading(true);

    void (async () => {
      try {
        const voices = await window.edgeTts?.getVoices?.();
        if (cancelled) return;

        if (!voices?.length) {
          setVoiceOptions([{ value: NARRATION_VOICE, label: 'Hoài My (vi-VN)' }]);
          setSelectedVoice(NARRATION_VOICE);
          return;
        }

        const mappedVoices = voices
          .filter(
            (voice: EdgeTtsVoice) =>
              voice.Locale === 'vi-VN' ||
              voice.ShortName?.startsWith('vi-VN-') ||
              voice.Name?.startsWith('vi-VN-'),
          )
          .map((voice: EdgeTtsVoice) => {
            const value = voice.ShortName || voice.Name;
            if (!value) return null;

            const label = voice.FriendlyName
              ? `${voice.FriendlyName} (${voice.Locale || value})`
              : `${value}${voice.Locale ? ` (${voice.Locale})` : ''}`;

            return { value, label };
          })
          .filter((voice): voice is NarrationVoiceOption => Boolean(voice));

        if (mappedVoices.length > 0) {
          const sortedVoices = [...mappedVoices].sort((a, b) => {
            if (a.value === NARRATION_VOICE) return -1;
            if (b.value === NARRATION_VOICE) return 1;
            return a.label.localeCompare(b.label);
          });

          setVoiceOptions(sortedVoices);
          setSelectedVoice((currentVoice) =>
            sortedVoices.some((voice) => voice.value === currentVoice)
              ? currentVoice
              : sortedVoices[0].value,
          );
          return;
        }
      } catch {
        if (!cancelled) {
          setVoiceOptions([{ value: NARRATION_VOICE, label: 'Hoài My (vi-VN)' }]);
          setSelectedVoice(NARRATION_VOICE);
        }
      } finally {
        if (!cancelled) {
          setIsVoiceLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === readerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth || document.documentElement.clientWidth || 0,
        height: window.innerHeight || document.documentElement.clientHeight || 0,
      });
    };

    window.addEventListener('resize', updateViewportSize);
    document.addEventListener('fullscreenchange', updateViewportSize);
    updateViewportSize();

    return () => {
      window.removeEventListener('resize', updateViewportSize);
      document.removeEventListener('fullscreenchange', updateViewportSize);
    };
  }, []);

  useLayoutEffect(() => {
    const pageFlip = bookRef.current?.pageFlip();

    window.dispatchEvent(new Event('resize'));
    pageFlip?.update?.();

    const frameId = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      pageFlip?.update?.();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isFullscreen, readerZoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      closeMenu();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeMenu]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      const toggleButton = menuToggleRef.current;
      const panel = menuPanelRef.current;

      if (!(target instanceof Node)) {
        closeMenu();
        return;
      }

      if (panel && toggleButton && !panel.contains(target) && !toggleButton.contains(target)) {
        closeMenu();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [closeMenu, isMenuOpen]);

  useEffect(() => {
    if (!isNarrationEnabled || !numPages || isNarrationLoading || narrationError) {
      return undefined;
    }

    const audio = narrationAudioRef.current;
    if (!audio) {
      return undefined;
    }

    const requestId = ++narrationRequestIdRef.current;
    let cancelled = false;

    const cleanupAudio = () => {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;

      if (narrationBlobUrlRef.current) {
        URL.revokeObjectURL(narrationBlobUrlRef.current);
        narrationBlobUrlRef.current = null;
      }
    };

    const handleEnded = () => {
      if (cancelled || requestId !== narrationRequestIdRef.current) {
        return;
      }

      if (narrationPageIndex >= numPages - 1) {
        pendingNarrationPageIndexRef.current = null;
        isNarrationPausedRef.current = false;
        setIsNarrationPaused(false);
        setIsNarrationEnabled(false);
        return;
      }

      const nextNarrationPageIndex = narrationPageIndex + 1;
      pendingNarrationPageIndexRef.current = nextNarrationPageIndex;
      if (narrationPagePauseTimeoutRef.current !== null) {
        window.clearTimeout(narrationPagePauseTimeoutRef.current);
      }
      continuePendingNarrationTransition(nextNarrationPageIndex, requestId);
    };

    const handleError = () => {
      if (cancelled || requestId !== narrationRequestIdRef.current) {
        return;
      }

      setNarrationError('Không thể phát Edge TTS.');
      pendingNarrationPageIndexRef.current = null;
      isNarrationPausedRef.current = false;
      setIsNarrationPaused(false);
      setIsNarrationEnabled(false);
    };

    cleanupAudio();
    audio.onended = handleEnded;
    audio.onerror = handleError;

    void (async () => {
      const startupTimingId = pendingNarrationStartupTimingIdRef.current;
      const foregroundTimingId = requestId;
      const textStartMark = `narration-text-start:${foregroundTimingId}`;
      const textEndMark = `narration-text-end:${foregroundTimingId}`;
      const prepareStartMark = `narration-prepare-start:${foregroundTimingId}`;
      const prepareEndMark = `narration-prepare-end:${foregroundTimingId}`;

      try {
        markNarrationPerformance(textStartMark);
        const narrationText = await getNarrationText(narrationPageIndex).finally(() => {
          markNarrationPerformance(textEndMark);
          measureNarrationPerformance(
            `narration-text:${foregroundTimingId}`,
            textStartMark,
            textEndMark,
          );
        });

        if (!narrationText) {
          handleEnded();
          return;
        }

        const narrationRate = formatNarrationPercentage(speechRate);
        const narrationVolume = formatNarrationPercentage(speechVolume);
        const narrationOptions = {
          voice: selectedVoice,
          ...(narrationRate ? { rate: narrationRate } : {}),
          ...(narrationVolume ? { volume: narrationVolume } : {}),
        };

        setIsNarrationSynthesizing(true);
        const key = registerNarrationPreparationRequest(
          narrationPageIndex,
          narrationText,
          narrationOptions.voice,
          narrationOptions.rate || '',
          narrationOptions.volume || '',
        );
        markNarrationPerformance(prepareStartMark);
        const cacheResult = await prepareNarrationForeground(key);
        markNarrationPerformance(prepareEndMark);
        measureNarrationPerformance(
          `${cacheResult.cacheHit ? 'narration-prepare-hit' : 'narration-prepare-miss'}:${foregroundTimingId}`,
          prepareStartMark,
          prepareEndMark,
        );
        measureNarrationDuration(
          `narration-cache-lookup:${foregroundTimingId}`,
          cacheResult.timings?.cacheLookupMs,
        );
        if (!cacheResult.cacheHit) {
          measureNarrationDuration(
            `narration-synthesis:${foregroundTimingId}`,
            cacheResult.timings?.synthesisMs,
          );
        }

        if (cancelled || requestId !== narrationRequestIdRef.current) {
          return;
        }

        if (!cacheResult.audioUrl) {
          throw new Error('Prepared narration audio URL is unavailable.');
        }

        if (narrationBlobUrlRef.current) {
          URL.revokeObjectURL(narrationBlobUrlRef.current);
          narrationBlobUrlRef.current = null;
        }

        audio.src = cacheResult.audioUrl;
        audio.currentTime = 0;
        audio.load();
        setIsNarrationPaused(false);
        narrationPlaybackOperationIdRef.current += 1;
        await audio.play();
        if (cancelled || requestId !== narrationRequestIdRef.current) {
          return;
        }

        const playingMark = `narration-playing:${startupTimingId ?? foregroundTimingId}`;
        markNarrationPerformance(playingMark);
        if (
          startupTimingId !== null &&
          startupTimingId === pendingNarrationStartupTimingIdRef.current &&
          startupTimingId === narrationStartupTimingOperationIdRef.current
        ) {
          measureNarrationPerformance(
            `narration-startup:${startupTimingId}`,
            `narration-start:${startupTimingId}`,
            playingMark,
          );
          pendingNarrationStartupTimingIdRef.current = null;
        }
        preloadNextNarrationPage(narrationPageIndex, narrationOptions, requestId);
      } catch (error) {
        if (cancelled || requestId !== narrationRequestIdRef.current) {
          return;
        }

        setNarrationError(
          error instanceof Error ? error.message : 'Không thể đọc văn bản bằng Edge TTS.',
        );
        pendingNarrationPageIndexRef.current = null;
        isNarrationPausedRef.current = false;
        setIsNarrationPaused(false);
        setIsNarrationEnabled(false);
      } finally {
        if (!cancelled && requestId === narrationRequestIdRef.current) {
          setIsNarrationSynthesizing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (narrationPagePauseTimeoutRef.current !== null) {
        window.clearTimeout(narrationPagePauseTimeoutRef.current);
        narrationPagePauseTimeoutRef.current = null;
      }
      cleanupAudio();
      setIsNarrationSynthesizing(false);
    };
  }, [
    continuePendingNarrationTransition,
    getNarrationText,
    isNarrationEnabled,
    isNarrationLoading,
    narrationError,
    narrationPageIndex,
    numPages,
    preloadNextNarrationPage,
    prepareNarrationForeground,
    registerNarrationPreparationRequest,
    selectedVoice,
    speechRate,
    speechVolume,
    formatNarrationPercentage,
  ]);

  useEffect(() => {
    if (!isAutoFlipEnabled) return undefined;

    if (!numPages || currentPageIndex >= numPages - 1) {
      setIsAutoFlipEnabled(false);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (currentPageIndex >= numPages - 1) {
        setIsAutoFlipEnabled(false);
        return;
      }

      flipToNextPage();
    }, AUTO_FLIP_INTERVAL);

    return () => window.clearInterval(intervalId);
  }, [currentPageIndex, flipToNextPage, isAutoFlipEnabled, numPages]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTtsSettings();
      }
    };

    if (isTtsSettingsOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isTtsSettingsOpen, closeTtsSettings]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const settingsButton = readerRef.current?.querySelector('button[aria-label="Cài đặt giọng đọc"]');
      const submenu = readerRef.current?.querySelector('.interactive-reader__tts-submenu');

      if (submenu && !submenu.contains(target) && settingsButton && !settingsButton.contains(target)) {
        closeTtsSettings();
      }
    };

    if (isTtsSettingsOpen) {
      window.addEventListener('mousedown', handleClickOutside);
      return () => window.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isTtsSettingsOpen, closeTtsSettings]);

  return {
    numPages,
    currentPageIndex,
    currentPage,
    pdfError,
    isMenuOpen,
    isTtsSettingsOpen,
    zoom,
    isFullscreen,
    viewportSize,
    isAutoFlipEnabled,
    isThumbnailPanelOpen,
    isNarrationEnabled,
    narrationPageIndex,
    isNarrationLoading,
    isNarrationSynthesizing,
    isNarrationPaused,
    isVoiceLoading,
    voiceOptions,
    selectedVoice,
    speechRate,
    speechVolume,
    sleepTimerMinutes,
    sleepTimerRemainingSeconds,
    narrationError,
    setNumPages,
    setPdfError,
    pages,
    resolvedPdfPath,
    resolvedPageFlipSoundPath,
    readerZoom,
    bookWidth,
    bookHeight,
    bookMaxWidth,
    bookMaxHeight,
    isAutoReadPreparing,
    readerRef,
    menuToggleRef,
    menuPanelRef,
    bookRef,
    pageFlipAudioRef,
    narrationAudioRef,
    setIsAutoFlipEnabled,
    setIsThumbnailPanelOpen,
    setSelectedVoice,
    setSpeechRate,
    setSpeechVolume,
    setSleepTimerMinutes,
    closeMenu,
    toggleMenu,
    toggleTtsSettings,
    closeTtsSettings,
    changeZoom,
    toggleFullscreen,
    toggleThumbnails,
    toggleNarration,
    toggleNarrationPlayback,
    flipToPage,
    flipToPreviousPage,
    flipToNextPage,
    readNarrationPage,
    handleFlip,
    onFlipbookInit,
  };
}
