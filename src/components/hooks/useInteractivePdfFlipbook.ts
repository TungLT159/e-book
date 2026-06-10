import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { getDocument } from 'pdfjs-dist';
import { resolvePublicAssetPath } from '../../utils/publicAsset';
import {
  normalizeNarrationAudioData,
  sanitizeNarrationText,
  textContentItemsToNarrationText,
  type PdfTextContentItem,
} from '../../utils/narration';
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
const NARRATION_PRELOAD_LOOKAHEAD = 1;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 1.35;
const ZOOM_STEP = 0.1;
const FULLSCREEN_ZOOM_MULTIPLIER = 1.18;
const AUTO_FLIP_INTERVAL = 3200;
const NARRATION_PAGE_PAUSE_MS = 1500;

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
  pageNarrationTexts: string[];
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

export function useInteractivePdfFlipbook({
  title,
  pdfPath,
  bookId,
  savedProgress,
  isReadingProgressLoaded = true,
  onProgressChange,
}: UseInteractivePdfFlipbookProps): UseInteractivePdfFlipbookResult {
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
  const [selectedVoice, setSelectedVoice] = useState(NARRATION_VOICE);
  const [speechRate, setSpeechRate] = useState(DEFAULT_NARRATION_RATE);
  const [pageNarrationTexts, setPageNarrationTexts] = useState<string[]>([]);
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
  const pendingNarrationPageIndexRef = useRef<number | null>(null);
  const isNarrationPausedRef = useRef(false);
  const narrationOperationIdRef = useRef(0);
  const extractedTextDebugFilePromiseRef = useRef<Promise<string> | null>(null);

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

  const formatNarrationRate = useCallback((rate: number) => {
    if (rate === 0) return undefined;
    return `${rate > 0 ? '+' : ''}${rate}%`;
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

  const preloadNextNarrationPage = useCallback(
    (
      pageIndex: number,
      narrationOptions: { voice: string; rate?: string },
      narrationRequestId: number,
    ) => {
      const nextPageIndex = pageIndex + NARRATION_PRELOAD_LOOKAHEAD;
      const prepareEdgeTtsAudioCacheFile = window.audioCache?.prepareEdgeTtsAudioCacheFile;
      const readExtractedTextPage = window.debugTools?.readExtractedTextPage;

      if (
        nextPageIndex >= numPages ||
        !prepareEdgeTtsAudioCacheFile ||
        !readExtractedTextPage
      ) {
        return;
      }

      const preloadRequestId = ++narrationPreloadRequestIdRef.current;

      void (async () => {
        try {
          const debugTextFilePath = await extractedTextDebugFilePromiseRef.current;
          if (
            preloadRequestId !== narrationPreloadRequestIdRef.current ||
            narrationRequestId !== narrationRequestIdRef.current ||
            !debugTextFilePath?.trim()
          ) {
            return;
          }

          const fileText = await readExtractedTextPage(debugTextFilePath, nextPageIndex + 1);
          if (
            preloadRequestId !== narrationPreloadRequestIdRef.current ||
            narrationRequestId !== narrationRequestIdRef.current
          ) {
            return;
          }

          const chunkText = sanitizeNarrationText(fileText);
          if (!chunkText) {
            return;
          }

          await prepareEdgeTtsAudioCacheFile({
            bookKey: title,
            voice: narrationOptions.voice,
            rate: narrationOptions.rate || '',
            chunkIndex: nextPageIndex,
            chunkText,
          });
        } catch {
          // Preload is best-effort; current narration should continue unaffected.
        }
      })();
    },
    [numPages, title],
  );

  const extractTextFromPdf = useCallback(async () => {
    if (!numPages) {
      return [] as string[];
    }

    const pdf = await getDocument({ url: resolvedPdfPath }).promise;
    const texts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContentItemsToNarrationText(textContent.items as PdfTextContentItem[]);

      texts.push(pageText);
    }

    return texts;
  }, [numPages, resolvedPdfPath]);

  const toggleNarration = useCallback(() => {
    setNarrationError(null);

    if (isNarrationEnabled) {
      narrationPlaybackOperationIdRef.current += 1;
      setIsNarrationEnabled(false);
      isNarrationPausedRef.current = false;
      setIsNarrationPaused(false);
      return;
    }

    void (async () => {
      const operationId = ++narrationOperationIdRef.current;
      setIsNarrationEnabled(true);
      setIsNarrationLoading(true);

      try {
        const texts = pageNarrationTexts.length > 0 ? pageNarrationTexts : await extractTextFromPdf();
        if (operationId !== narrationOperationIdRef.current) return;

        const writeExtractedText = window.debugTools?.writeExtractedText;

        if (!writeExtractedText) {
          throw new Error('Không thể tạo file văn bản đã định dạng.');
        }

        if (pageNarrationTexts.length === 0) {
          setPageNarrationTexts(texts);
        }

        const filePromise = writeExtractedText({
          title,
          pdfPath,
          pages: texts,
        });
        extractedTextDebugFilePromiseRef.current = filePromise;
        const filePath = await filePromise;
        if (operationId !== narrationOperationIdRef.current) return;

        if (!filePath?.trim()) {
          throw new Error('Không thể tạo file văn bản đã định dạng.');
        }

        setIsNarrationSynthesizing(true);
        setNarrationPageIndex(currentPageIndex);
        setIsNarrationEnabled(true);
      } catch (error) {
        if (operationId !== narrationOperationIdRef.current) return;

        extractedTextDebugFilePromiseRef.current = null;
        setNarrationError(
          error instanceof Error ? error.message : 'Không thể chuẩn bị file văn bản để đọc.',
        );
        setIsNarrationEnabled(false);
      } finally {
        if (operationId === narrationOperationIdRef.current) {
          setIsNarrationLoading(false);
        }
      }
    })();
  }, [currentPageIndex, extractTextFromPdf, isNarrationEnabled, pageNarrationTexts, pdfPath, title]);

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
      narrationOperationIdRef.current += 1;
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
    let cancelled = false;

    setPageNarrationTexts([]);
    setNarrationError(null);
    setIsNarrationLoading(Boolean(numPages));
    setIsNarrationEnabled(false);
    extractedTextDebugFilePromiseRef.current = null;
    stopNarration();

    if (!numPages) {
      setIsNarrationLoading(false);
      return undefined;
    }

    void (async () => {
      try {
        const texts = await extractTextFromPdf();
        if (!cancelled) {
          setPageNarrationTexts(texts);
        }
      } catch (error) {
        if (!cancelled) {
          setNarrationError(
            error instanceof Error ? error.message : 'Không thể chuẩn bị văn bản để đọc.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsNarrationLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [extractTextFromPdf, numPages, stopNarration]);

  useEffect(() => {
    let cancelled = false;

    setIsVoiceLoading(true);

    void (async () => {
      try {
        const voices = await window.edgeTts?.getVoices?.();
        if (cancelled) return;

        if (!voices?.length) {
          setVoiceOptions([{ value: NARRATION_VOICE, label: 'Hoài My (vi-VN)' }]);
          setSelectedVoice((currentVoice) => currentVoice || NARRATION_VOICE);
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

  useLayoutEffect(() => {
    if (!isMenuOpen) return undefined;

    const updateMenuPosition = () => {
      const toggleButton = menuToggleRef.current;
      if (!toggleButton) return;

      const rect = toggleButton.getBoundingClientRect();
      const shellRect = toggleButton.closest('.interactive-reader')?.querySelector('.interactive-reader__shell')?.getBoundingClientRect();
      const width = 320;
      const containerLeft = shellRect?.left ?? 0;
      const containerTop = shellRect?.top ?? 0;
      const containerWidth = shellRect?.width ?? (window.innerWidth || document.documentElement.clientWidth);
      const left = Math.max(8, Math.min(rect.right - containerLeft - width, containerWidth - width - 8));
      const top = Math.max(8, rect.bottom - containerTop);

      menuPanelRef.current?.style.setProperty('top', `${top}px`);
      menuPanelRef.current?.style.setProperty('left', `${left}px`);
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isMenuOpen]);

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
        setIsNarrationLoading(true);
        setPageNarrationTexts([]);

        const debugTextFilePromise = extractedTextDebugFilePromiseRef.current;
        extractedTextDebugFilePromiseRef.current = null;
        const operationId = ++narrationOperationIdRef.current;

        void (async () => {
          try {
            const debugTextFilePath = await debugTextFilePromise;
            const emptyExtractedTextFile = window.debugTools?.emptyExtractedTextFile;

            if (!debugTextFilePath?.trim() || !emptyExtractedTextFile) {
              throw new Error('Không thể làm trống file văn bản đã định dạng.');
            }

            await emptyExtractedTextFile(debugTextFilePath);
          } catch (error) {
            if (operationId !== narrationOperationIdRef.current) return;

            setNarrationError(
              error instanceof Error ? error.message : 'Không thể làm trống file văn bản đã định dạng.',
            );
          } finally {
            if (operationId === narrationOperationIdRef.current) {
              setIsNarrationLoading(false);
            }
          }
        })();
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
      try {
        const debugTextFilePath = await extractedTextDebugFilePromiseRef.current;
        const readExtractedTextPage = window.debugTools?.readExtractedTextPage;

        if (!debugTextFilePath?.trim() || !readExtractedTextPage) {
          throw new Error('Không thể đọc file văn bản đã định dạng.');
        }

        const fileText = await readExtractedTextPage(debugTextFilePath, narrationPageIndex + 1);
        const narrationText = sanitizeNarrationText(fileText);

        if (!narrationText) {
          handleEnded();
          return;
        }

        const edgeTts = window.edgeTts;
        if (!edgeTts) {
          throw new Error('Edge TTS is unavailable.');
        }

        const narrationOptions = {
          voice: selectedVoice,
          ...(formatNarrationRate(speechRate) ? { rate: formatNarrationRate(speechRate) } : {}),
        };

        const audioCache = window.audioCache;
        const cacheResult = audioCache
          ? await audioCache.getOrCreateEdgeTtsAudioCacheFile({
              bookKey: title,
              voice: narrationOptions.voice,
              rate: narrationOptions.rate || '',
              chunkIndex: narrationPageIndex,
              chunkText: narrationText,
            })
          : null;

        if (cacheResult?.cacheHit && cacheResult.audioUrl) {
          if (cancelled || requestId !== narrationRequestIdRef.current) {
            return;
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
          preloadNextNarrationPage(narrationPageIndex, narrationOptions, requestId);
          return;
        }

        setIsNarrationSynthesizing(true);
        const audioData = await edgeTts.synthesize(narrationText, narrationOptions);

        if (cancelled || requestId !== narrationRequestIdRef.current) {
          return;
        }

        const blobSource = normalizeNarrationAudioData(audioData);
        const blob = new Blob([blobSource], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        if (narrationBlobUrlRef.current) {
          URL.revokeObjectURL(narrationBlobUrlRef.current);
        }
        narrationBlobUrlRef.current = url;

        audio.src = url;
        audio.currentTime = 0;
        audio.load();
        setIsNarrationPaused(false);
        narrationPlaybackOperationIdRef.current += 1;
        await audio.play();
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
    isNarrationEnabled,
    isNarrationLoading,
    narrationError,
    narrationPageIndex,
    numPages,
    preloadNextNarrationPage,
    selectedVoice,
    speechRate,
    formatNarrationRate,
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
      const settingsButton = readerRef.current?.querySelector('button[aria-label="Cài đặt TTS"]');
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
    pageNarrationTexts,
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
