import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, RefObject } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Images,
  Library,
  Maximize,
  Menu,
  Minimize,
  Pause,
  Play,
  Settings,
  SkipBack,
  SkipForward,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import HTMLFlipBook from "react-pageflip";
import { Document, Page, pdfjs } from "react-pdf";
import { getDocument } from "pdfjs-dist";
import { PDF_WORKER_URL } from "../hooks/pdfWorker";
import { resolvePublicAssetPath } from "../utils/publicAsset";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

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
const PAGE_FLIP_SOUND_PATH = "/Audio/effects/page-flip.mp3";
const NARRATION_VOICE = "vi-VN-NamMinhNeural";
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

type FlipbookStageProps = {
  numPages: number;
  bookRef: RefObject<PageFlipRef | null>;
  pageWidth: number;
  width: number;
  height: number;
  maxWidth: number;
  maxHeight: number;
  onFlip: (event: { data: number }) => void;
};

type InteractivePdfFlipbookProps = {
  title: string;
  pdfPath: string;
  onBackToLibrary?: () => void;
} & Record<string, unknown>;

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

type NarrationVoiceOption = {
  value: string;
  label: string;
};

export type PdfTextContentItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

export { resolvePublicAssetPath };

export function sanitizeNarrationText(text: string) {
  let sanitized = "";

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const nextCode = text.charCodeAt(index + 1);

    if (code >= 0xd800 && code <= 0xdbff) {
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        sanitized += text[index] + text[index + 1];
        index += 1;
      }
      continue;
    }

    if (code >= 0xdc00 && code <= 0xdfff) {
      continue;
    }

    sanitized += text[index];
  }

  return sanitized
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function removeLeadingPageNumber(text: string) {
  return text.replace(/^\d+\s+(?=\p{L})/u, "").replace(/^\d+(?=\p{L})/u, "");
}

export function textContentItemsToNarrationText(items: PdfTextContentItem[]) {
  let text = "";

  const appendSpace = () => {
    if (text && !/\s$/.test(text)) {
      text += " ";
    }
  };

  for (const item of items) {
    const itemText = item.str || "";

    text += itemText;

    if (item.hasEOL) {
      appendSpace();
    }
  }

  return removeLeadingPageNumber(sanitizeNarrationText(text));
}

type NarrationAudioChunk = {
  startPage: number;
  endPage: number;
  text: string;
};

const SENTENCE_BOUNDARY_PATTERN = /[.!?](?:["')\]]+)?\s*$/;

function hasParagraphBoundary(text: string) {
  return /\n\s*\n\s*$/.test(text);
}

function hasSentenceBoundary(text: string) {
  return SENTENCE_BOUNDARY_PATTERN.test(text.trimEnd());
}

export function buildNarrationAudioChunks(
  pageTexts: string[],
): NarrationAudioChunk[] {
  if (pageTexts.length === 0) {
    return [];
  }

  const chunks: NarrationAudioChunk[] = [];
  for (let startIndex = 0; startIndex < pageTexts.length; ) {
    const maxEndIndex = Math.min(startIndex + 2, pageTexts.length - 1);
    let chosenEndIndex = maxEndIndex;

    for (let index = maxEndIndex; index >= startIndex; index -= 1) {
      if (hasParagraphBoundary(pageTexts[index] || "")) {
        chosenEndIndex = index;
        break;
      }
    }

    if (chosenEndIndex === maxEndIndex) {
      for (let index = maxEndIndex; index >= startIndex; index -= 1) {
        if (hasSentenceBoundary(pageTexts[index] || "")) {
          chosenEndIndex = index;
          break;
        }
      }
    }

    const chunkPages = pageTexts.slice(startIndex, chosenEndIndex + 1);

    chunks.push({
      startPage: startIndex + 1,
      endPage: chosenEndIndex + 1,
      text: chunkPages.join("\n\n"),
    });

    startIndex = chosenEndIndex + 1;
  }

  return chunks;
}

export function normalizeNarrationAudioData(audioData: unknown) {
  if (audioData instanceof ArrayBuffer) {
    return audioData;
  }

  if (ArrayBuffer.isView(audioData)) {
    const view = audioData as ArrayBufferView;
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
  }

  if (
    audioData &&
    typeof audioData === "object" &&
    "data" in audioData &&
    Array.isArray((audioData as { data?: unknown }).data)
  ) {
    return new Uint8Array((audioData as { data: number[] }).data).buffer;
  }

  if (audioData && typeof audioData === "object") {
    const bytes = Object.entries(audioData)
      .filter(([key, value]) => /^\d+$/.test(key) && typeof value === "number")
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([, value]) => value as number);

    if (bytes.length > 0) {
      return new Uint8Array(bytes).buffer;
    }
  }

  throw new Error("Dữ liệu âm thanh Edge TTS không hợp lệ.");
}

const FlipbookStage = memo(function FlipbookStage({
  numPages,
  bookRef,
  pageWidth,
  width,
  height,
  maxWidth,
  maxHeight,
  onFlip,
}: FlipbookStageProps) {
  const pages = Array.from({ length: numPages }, (_, index) => index + 1);

  return (
    <HTMLFlipBook
      ref={bookRef}
      startPage={0}
      width={width}
      height={height}
      size="stretch"
      minWidth={320}
      maxWidth={maxWidth}
      minHeight={440}
      maxHeight={maxHeight}
      drawShadow={true}
      flippingTime={FLIPPING_TIME}
      usePortrait={false}
      startZIndex={1}
      autoSize={false}
      maxShadowOpacity={0.24}
      showCover={true}
      mobileScrollSupport={true}
      clickEventForward={true}
      useMouseEvents={true}
      swipeDistance={30}
      showPageCorners={false}
      disableFlipByClick={false}
      renderOnlyPageLengthChange={true}
      className="interactive-reader__book"
      style={{ width: "100%", height: "100%" }}
      onFlip={onFlip}
    >
      {pages.map((pageNumber) => {
        const isFrontCover = pageNumber === 1;
        const isBackCover = pageNumber === numPages;
        const pageClassName = [
          "interactive-reader__page",
          isFrontCover && "interactive-reader__page--front-cover",
          isBackCover && "interactive-reader__page--back-cover",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <article
            aria-label={
              isFrontCover
                ? `Bìa trước: trang ${pageNumber}`
                : isBackCover
                  ? `Bìa sau: trang ${pageNumber}`
                  : `Trang ${pageNumber}`
            }
            className={pageClassName}
            key={pageNumber}
          >
            <Page
              pageNumber={pageNumber}
              width={pageWidth}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              className="interactive-reader__pdf-page"
            />
          </article>
        );
      })}
    </HTMLFlipBook>
  );
});

export function InteractivePdfFlipbook({
  title,
  pdfPath,
  onBackToLibrary,
}: InteractivePdfFlipbookProps) {
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
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceOptions, setVoiceOptions] = useState<NarrationVoiceOption[]>([
    { value: NARRATION_VOICE, label: "Hoài My (vi-VN)" },
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
  const narrationBlobUrlRef = useRef<string | null>(null);
  const narrationRequestIdRef = useRef(0);
  const narrationPreloadRequestIdRef = useRef(0);
  const narrationPagePauseTimeoutRef = useRef<number | null>(null);
  const narrationOperationIdRef = useRef(0);
  const extractedTextDebugFilePromiseRef = useRef<Promise<string> | null>(null);

  const currentPage = currentPageIndex + 1;
  const pages = Array.from({ length: numPages }, (_, index) => index + 1);
  const resolvedPdfPath = resolvePublicAssetPath(pdfPath);
  const resolvedPageFlipSoundPath =
    resolvePublicAssetPath(PAGE_FLIP_SOUND_PATH);
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

  const formatNarrationRate = useCallback((rate: number) => {
    if (rate === 0) return undefined;
    return `${rate > 0 ? "+" : ""}${rate}%`;
  }, []);

  const isPageVisibleInCurrentSpread = useCallback(
    (pageIndex: number) => {
      const currentVisiblePageIndex = currentPageIndexRef.current;

      if (pageIndex === currentVisiblePageIndex) return true;

      return (
        currentVisiblePageIndex > 0 && pageIndex === currentVisiblePageIndex + 1
      );
    },
    [],
  );

  const playPageFlipSound = useCallback(() => {
    const sound = pageFlipAudioRef.current;
    if (!sound) return;

    sound.currentTime = 0;
    void sound.play().catch(() => undefined);
  }, []);

  const stopNarration = useCallback(() => {
    narrationRequestIdRef.current += 1;
    narrationPreloadRequestIdRef.current += 1;

    if (narrationPagePauseTimeoutRef.current !== null) {
      window.clearTimeout(narrationPagePauseTimeoutRef.current);
      narrationPagePauseTimeoutRef.current = null;
    }

    const audio = narrationAudioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    if (narrationBlobUrlRef.current) {
      URL.revokeObjectURL(narrationBlobUrlRef.current);
      narrationBlobUrlRef.current = null;
    }

    setIsNarrationSynthesizing(false);
  }, []);

  const preloadNextNarrationPage = useCallback(
    (
      pageIndex: number,
      narrationOptions: { voice: string; rate?: string },
      narrationRequestId: number,
    ) => {
      const nextPageIndex = pageIndex + NARRATION_PRELOAD_LOOKAHEAD;
      const prepareEdgeTtsAudioCacheFile =
        window.audioCache?.prepareEdgeTtsAudioCacheFile;
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
          const debugTextFilePath =
            await extractedTextDebugFilePromiseRef.current;
          if (
            preloadRequestId !== narrationPreloadRequestIdRef.current ||
            narrationRequestId !== narrationRequestIdRef.current ||
            !debugTextFilePath?.trim()
          ) {
            return;
          }

          const fileText = await readExtractedTextPage(
            debugTextFilePath,
            nextPageIndex + 1,
          );
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
            rate: narrationOptions.rate || "",
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
      const pageText = textContentItemsToNarrationText(
        textContent.items as PdfTextContentItem[],
      );

      texts.push(pageText);
    }

    return texts;
  }, [numPages, resolvedPdfPath]);

  const toggleNarration = useCallback(() => {
    setNarrationError(null);

    if (isNarrationEnabled) {
      setIsNarrationEnabled(false);
      return;
    }

    void (async () => {
      const operationId = ++narrationOperationIdRef.current;
      setIsNarrationLoading(true);

      try {
        const texts =
          pageNarrationTexts.length > 0
            ? pageNarrationTexts
            : await extractTextFromPdf();
        if (operationId !== narrationOperationIdRef.current) return;

        const writeExtractedText = window.debugTools?.writeExtractedText;

        if (!writeExtractedText) {
          throw new Error("Không thể tạo file văn bản đã định dạng.");
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
          throw new Error("Không thể tạo file văn bản đã định dạng.");
        }

        setNarrationPageIndex(currentPageIndex);
        setIsNarrationEnabled(true);
      } catch (error) {
        if (operationId !== narrationOperationIdRef.current) return;

        extractedTextDebugFilePromiseRef.current = null;
        setNarrationError(
          error instanceof Error
            ? error.message
            : "Không thể chuẩn bị file văn bản để đọc.",
        );
        setIsNarrationEnabled(false);
      } finally {
        if (operationId === narrationOperationIdRef.current) {
          setIsNarrationLoading(false);
        }
      }
    })();
  }, [
    currentPageIndex,
    extractTextFromPdf,
    isNarrationEnabled,
    pageNarrationTexts,
    pdfPath,
    title,
  ]);

  const setVisiblePage = useCallback((pageIndex: number) => {
    const nextPage = pageIndex + 1;
    currentPageIndexRef.current = pageIndex;
    lastSyncedPageRef.current = nextPage;
    setCurrentPageIndex(pageIndex);
  }, []);

  const handleFlip = useCallback(
    (event: { data: number }) => {
      playPageFlipSound();

      if (flipSettledTimeoutRef.current !== null) {
        window.clearTimeout(flipSettledTimeoutRef.current);
      }

      flipSettledTimeoutRef.current = window.setTimeout(() => {
        setVisiblePage(event.data);
        flipSettledTimeoutRef.current = null;
      }, FLIPPING_TIME);
    },
    [playPageFlipSound, setVisiblePage],
  );

  const flipToPage = useCallback(
    (pageIndex: number) => {
      if (!numPages) return;

      const targetPageIndex = Math.min(Math.max(pageIndex, 0), numPages - 1);
      bookRef.current?.pageFlip().flip(targetPageIndex);
      setVisiblePage(targetPageIndex);
      setIsThumbnailPanelOpen(false);
    },
    [numPages, setVisiblePage],
  );

  const flipToPreviousPage = useCallback(() => {
    if (currentPageIndex <= 0) return;

    bookRef.current?.pageFlip().flipPrev();
  }, [currentPageIndex]);

  const flipToNextPage = useCallback(() => {
    if (!numPages || currentPageIndexRef.current >= numPages - 1) return;

    bookRef.current?.pageFlip().flipNext();
  }, [numPages]);

  const changeZoom = useCallback((direction: 1 | -1) => {
    setZoom((currentZoom) => {
      const nextZoom = currentZoom + direction * ZOOM_STEP;
      return Math.min(
        Math.max(Number(nextZoom.toFixed(2)), MIN_ZOOM),
        MAX_ZOOM,
      );
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
    setCurrentPageIndex(0);

    return () => {
      narrationOperationIdRef.current += 1;
    };
  }, [pdfPath, title]);

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
            error instanceof Error
              ? error.message
              : "Không thể chuẩn bị văn bản để đọc.",
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
          setVoiceOptions([
            { value: NARRATION_VOICE, label: "Hoài My (vi-VN)" },
          ]);
          setSelectedVoice((currentVoice) => currentVoice || NARRATION_VOICE);
          return;
        }

        const mappedVoices = voices
          .filter(
            (voice: EdgeTtsVoice) =>
              voice.Locale === "vi-VN" ||
              voice.ShortName?.startsWith("vi-VN-") ||
              voice.Name?.startsWith("vi-VN-"),
          )
          .map((voice: EdgeTtsVoice) => {
            const value = voice.ShortName || voice.Name;
            if (!value) return null;

            const label = voice.FriendlyName
              ? `${voice.FriendlyName} (${voice.Locale || value})`
              : `${value}${voice.Locale ? ` (${voice.Locale})` : ""}`;

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
          setVoiceOptions([
            { value: NARRATION_VOICE, label: "Hoài My (vi-VN)" },
          ]);
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

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth || document.documentElement.clientWidth || 0,
        height: window.innerHeight || document.documentElement.clientHeight || 0,
      });
    };

    window.addEventListener("resize", updateViewportSize);
    document.addEventListener("fullscreenchange", updateViewportSize);
    updateViewportSize();

    return () => {
      window.removeEventListener("resize", updateViewportSize);
      document.removeEventListener("fullscreenchange", updateViewportSize);
    };
  }, []);

  useLayoutEffect(() => {
    const pageFlip = bookRef.current?.pageFlip();

    window.dispatchEvent(new Event("resize"));
    pageFlip?.update?.();

    const frameId = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
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
      const shellRect = toggleButton
        .closest(".interactive-reader")
        ?.querySelector(".interactive-reader__shell")
        ?.getBoundingClientRect();
      const width = 320;
      const containerLeft = shellRect?.left ?? 0;
      const containerTop = shellRect?.top ?? 0;
      const containerWidth = shellRect?.width ?? (window.innerWidth || document.documentElement.clientWidth);
      const left = Math.max(
        8,
        Math.min(rect.right - containerLeft - width, containerWidth - width - 8),
      );
      const top = Math.max(8, rect.bottom - containerTop);

      // Keep the panel attached to the hamburger bottom edge in the shell's coordinate system.
      menuPanelRef.current?.style.setProperty("top", `${top}px`);
      menuPanelRef.current?.style.setProperty("left", `${left}px`);
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      closeMenu();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

      if (
        panel &&
        toggleButton &&
        !panel.contains(target) &&
        !toggleButton.contains(target)
      ) {
        closeMenu();
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [closeMenu, isMenuOpen]);

  useEffect(() => {
    if (
      !isNarrationEnabled ||
      !numPages ||
      isNarrationLoading ||
      narrationError
    ) {
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
        setIsNarrationEnabled(false);
        setIsNarrationLoading(true);
        setPageNarrationTexts([]);

        const debugTextFilePromise = extractedTextDebugFilePromiseRef.current;
        extractedTextDebugFilePromiseRef.current = null;
        const operationId = ++narrationOperationIdRef.current;

        void (async () => {
          try {
            const debugTextFilePath = await debugTextFilePromise;
            const emptyExtractedTextFile =
              window.debugTools?.emptyExtractedTextFile;

            if (!debugTextFilePath?.trim() || !emptyExtractedTextFile) {
              throw new Error("Không thể làm trống file văn bản đã định dạng.");
            }

            await emptyExtractedTextFile(debugTextFilePath);
          } catch (error) {
            if (operationId !== narrationOperationIdRef.current) return;

            setNarrationError(
              error instanceof Error
                ? error.message
                : "Không thể làm trống file văn bản đã định dạng.",
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
      if (narrationPagePauseTimeoutRef.current !== null) {
        window.clearTimeout(narrationPagePauseTimeoutRef.current);
      }

      narrationPagePauseTimeoutRef.current = window.setTimeout(() => {
        narrationPagePauseTimeoutRef.current = null;

        if (cancelled || requestId !== narrationRequestIdRef.current) {
          return;
        }

        if (isPageVisibleInCurrentSpread(nextNarrationPageIndex)) {
          setNarrationPageIndex(nextNarrationPageIndex);
          return;
        }

        flipToNextPage();
        narrationPagePauseTimeoutRef.current = window.setTimeout(() => {
          narrationPagePauseTimeoutRef.current = null;

          if (cancelled || requestId !== narrationRequestIdRef.current) {
            return;
          }

          setNarrationPageIndex(nextNarrationPageIndex);
        }, FLIPPING_TIME);
      }, NARRATION_PAGE_PAUSE_MS);
    };

    const handleError = () => {
      if (cancelled || requestId !== narrationRequestIdRef.current) {
        return;
      }

      setNarrationError("Không thể phát Edge TTS.");
      setIsNarrationEnabled(false);
    };

    cleanupAudio();
    audio.onended = handleEnded;
    audio.onerror = handleError;

    void (async () => {
      try {
        const debugTextFilePath =
          await extractedTextDebugFilePromiseRef.current;
        const readExtractedTextPage = window.debugTools?.readExtractedTextPage;

        if (!debugTextFilePath?.trim() || !readExtractedTextPage) {
          throw new Error("Không thể đọc file văn bản đã định dạng.");
        }

        const fileText = await readExtractedTextPage(
          debugTextFilePath,
          narrationPageIndex + 1,
        );
        const narrationText = sanitizeNarrationText(fileText);

        if (!narrationText) {
          handleEnded();
          return;
        }

        const edgeTts = window.edgeTts;
        if (!edgeTts) {
          throw new Error("Edge TTS is unavailable.");
        }

        const narrationOptions = {
          voice: selectedVoice,
          ...(formatNarrationRate(speechRate)
            ? { rate: formatNarrationRate(speechRate) }
            : {}),
        };

        const audioCache = window.audioCache;
        const cacheResult = audioCache
          ? await audioCache.getOrCreateEdgeTtsAudioCacheFile({
              bookKey: title,
              voice: narrationOptions.voice,
              rate: narrationOptions.rate || "",
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
          await audio.play();
          preloadNextNarrationPage(
            narrationPageIndex,
            narrationOptions,
            requestId,
          );
          return;
        }

        setIsNarrationSynthesizing(true);
        const audioData = await edgeTts.synthesize(
          narrationText,
          narrationOptions,
        );

        if (cancelled || requestId !== narrationRequestIdRef.current) {
          return;
        }

        const blobSource = normalizeNarrationAudioData(audioData);
        const blob = new Blob([blobSource], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        if (narrationBlobUrlRef.current) {
          URL.revokeObjectURL(narrationBlobUrlRef.current);
        }
        narrationBlobUrlRef.current = url;

        audio.src = url;
        audio.currentTime = 0;
        audio.load();
        await audio.play();
        preloadNextNarrationPage(
          narrationPageIndex,
          narrationOptions,
          requestId,
        );
      } catch (error) {
        if (cancelled || requestId !== narrationRequestIdRef.current) {
          return;
        }

        setNarrationError(
          error instanceof Error
            ? error.message
            : "Không thể đọc văn bản bằng Edge TTS.",
        );
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
    flipToNextPage,
    isPageVisibleInCurrentSpread,
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

  // Handle ESC key to close TTS settings
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTtsSettings();
      }
    };

    if (isTtsSettingsOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isTtsSettingsOpen, closeTtsSettings]);

  // Handle click-outside to close TTS settings
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const settingsButton = readerRef.current?.querySelector(
        'button[aria-label="Cài đặt TTS"]',
      );
      const submenu = readerRef.current?.querySelector(
        ".interactive-reader__tts-submenu",
      );

      if (
        submenu &&
        !submenu.contains(target) &&
        settingsButton &&
        !settingsButton.contains(target)
      ) {
        closeTtsSettings();
      }
    };

    if (isTtsSettingsOpen) {
      window.addEventListener("mousedown", handleClickOutside);
      return () => window.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isTtsSettingsOpen, closeTtsSettings]);

  return (
    <section
      ref={readerRef}
      className="interactive-reader"
      aria-label={`Trình đọc tương tác cho ${title}`}
      style={{ "--interactive-reader-zoom": readerZoom } as CSSProperties}
    >
      <header className="interactive-reader__header">
        <div className="interactive-reader__title-group">
          {onBackToLibrary && (
            <button
              type="button"
              className="interactive-reader__library-back"
              onClick={onBackToLibrary}
              aria-label="Về thư viện"
              title="Về thư viện"
            >
              <ArrowLeft aria-hidden="true" />
              <span>Thư viện</span>
            </button>
          )}
          <h2>{title}</h2>
        </div>
        <p className="interactive-reader__status">
          Trang {currentPage} / {numPages || "-"}
        </p>

        <button
          type="button"
          className="interactive-reader__menu-toggle"
          ref={menuToggleRef}
          onClick={toggleMenu}
          aria-expanded={isMenuOpen}
          aria-label={
            isMenuOpen ? "Đóng menu điều khiển" : "Mở menu điều khiển"
          }
          title={isMenuOpen ? "Đóng menu điều khiển" : "Mở menu điều khiển"}
        >
          {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>

      <div className="interactive-reader__shell">
        {isMenuOpen && (
          <nav
            ref={menuPanelRef}
            className="interactive-reader__menu-panel"
            role="navigation"
            aria-label="Menu điều khiển trình đọc"
            data-state="open"
            style={{ position: "absolute", zIndex: 40 }}
          >
            <div className="interactive-reader__menu-sections">
              {/* Section 1: View Controls */}
              <div className="menu-section menu-section--view">
                <h3 className="menu-section__title">View</h3>
                <button
                  type="button"
                  onClick={() => changeZoom(1)}
                  disabled={zoom >= MAX_ZOOM}
                  aria-label="Phóng to"
                  title="Phóng to"
                >
                  <ZoomIn aria-hidden="true" />
                  Phóng to
                </button>
                <button
                  type="button"
                  onClick={() => changeZoom(-1)}
                  disabled={zoom <= MIN_ZOOM}
                  aria-label="Thu nhỏ"
                  title="Thu nhỏ"
                >
                  <ZoomOut aria-hidden="true" />
                  Thu nhỏ
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={
                    isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"
                  }
                  title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                >
                  {isFullscreen ? (
                    <Minimize aria-hidden="true" />
                  ) : (
                    <Maximize aria-hidden="true" />
                  )}
                  {isFullscreen ? "Thoát" : "Toàn màn hình"}
                </button>
                <button
                  type="button"
                  onClick={toggleThumbnails}
                  aria-label="Hình thu nhỏ"
                  title="Hình thu nhỏ"
                >
                  <Images aria-hidden="true" />
                  Hình thu nhỏ
                </button>
              </div>

              {/* Section 2: Audio & Tools */}
              <div className="menu-section menu-section--audio">
                <h3 className="menu-section__title">Audio & Tools</h3>
                <button
                  type="button"
                  onClick={toggleNarration}
                  disabled={!numPages || isNarrationLoading}
                  aria-label={
                    isNarrationSynthesizing
                      ? "Đang tạo giọng đọc"
                      : isNarrationEnabled
                        ? "Dừng đọc"
                        : "Đọc tự động"
                  }
                  title={
                    isNarrationSynthesizing
                      ? "Đang tạo giọng đọc"
                      : isNarrationEnabled
                        ? "Dừng đọc"
                        : "Đọc tự động"
                  }
                >
                  {isNarrationEnabled ? (
                    <Pause aria-hidden="true" />
                  ) : (
                    <Play aria-hidden="true" />
                  )}
                  {isNarrationSynthesizing
                    ? "Đang tạo giọng đọc..."
                    : isNarrationEnabled
                      ? "Dừng đọc"
                      : "Đọc tự động"}
                </button>

                {/* TTS Settings with Submenu */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={toggleTtsSettings}
                    aria-label="Cài đặt TTS"
                    title="Cài đặt TTS"
                    aria-expanded={isTtsSettingsOpen}
                  >
                    <Settings aria-hidden="true" />
                    Cài đặt TTS
                  </button>

                  {isTtsSettingsOpen && (
                    <div
                      className="interactive-reader__tts-submenu"
                      aria-label="Cài đặt TTS"
                    >
                      <div className="interactive-reader__tts-submenu-header">
                        <h4>Cài đặt TTS</h4>
                        <button
                          type="button"
                          className="interactive-reader__tts-submenu-close"
                          onClick={closeTtsSettings}
                          aria-label="Đóng"
                          title="Đóng"
                        >
                          <X aria-hidden="true" />
                        </button>
                      </div>

                      <label className="interactive-reader__tts-field">
                        <span>Giọng đọc</span>
                        <select
                          value={selectedVoice}
                          onChange={(event) =>
                            setSelectedVoice(event.target.value)
                          }
                          disabled={isVoiceLoading || voiceOptions.length === 0}
                          aria-label="Giọng đọc"
                        >
                          {voiceOptions.map((voice) => (
                            <option key={voice.value} value={voice.value}>
                              {voice.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="interactive-reader__tts-field">
                        <span>Tốc độ đọc</span>
                        <input
                          type="range"
                          min={-50}
                          max={50}
                          step={5}
                          value={speechRate}
                          onChange={(event) =>
                            setSpeechRate(Number(event.target.value))
                          }
                          aria-label="Tốc độ đọc"
                        />
                        <output aria-live="polite">
                          {speechRate === 0
                            ? "Bình thường"
                            : `${speechRate > 0 ? "+" : ""}${speechRate}%`}
                        </output>
                      </label>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsAutoFlipEnabled((prev) => !prev)}
                  disabled={!numPages || currentPageIndex >= numPages - 1}
                  aria-label={isAutoFlipEnabled ? "Dừng tự lật" : "Tự lật trang"}
                  title={isAutoFlipEnabled ? "Dừng tự lật" : "Tự lật trang"}
                >
                  {isAutoFlipEnabled ? (
                    <Pause aria-hidden="true" />
                  ) : (
                    <Play aria-hidden="true" />
                  )}
                  {isAutoFlipEnabled ? "Dừng tự lật" : "Tự lật"}
                </button>

                <button
                  type="button"
                  onClick={() => flipToPage(0)}
                  disabled={!numPages || currentPageIndex <= 0}
                  aria-label="Trang đầu"
                  title="Trang đầu"
                >
                  <SkipBack aria-hidden="true" />
                  Trang đầu
                </button>

                <button
                  type="button"
                  onClick={() => flipToPage(numPages - 1)}
                  disabled={!numPages || currentPageIndex >= numPages - 1}
                  aria-label="Trang cuối"
                  title="Trang cuối"
                >
                  <SkipForward aria-hidden="true" />
                  Trang cuối
                </button>
              </div>
            </div>
          </nav>
        )}

        {narrationError && (
          <p className="interactive-reader__message interactive-reader__message--error">
            {narrationError}
          </p>
        )}

        <button
          type="button"
          className="interactive-reader__nav interactive-reader__nav--prev"
          onClick={flipToPreviousPage}
          disabled={currentPageIndex <= 0}
          aria-label="Trang trước"
          title="Trang trước"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className="interactive-reader__nav interactive-reader__nav--next"
          onClick={flipToNextPage}
          disabled={!numPages || currentPageIndex >= numPages - 1}
          aria-label="Trang tiếp theo"
          title="Trang tiếp theo"
        >
          <ChevronRight aria-hidden="true" />
        </button>

        <Document
          className="interactive-reader__document"
          file={resolvedPdfPath}
          loading={<p className="interactive-reader__message">Đang tải PDF...</p>}
          error={
            <div className="interactive-reader__message interactive-reader__message--error">
              <p>Không thể tải PDF.</p>
              {pdfError && <p>{pdfError}</p>}
              <p>Đường dẫn: {resolvedPdfPath}</p>
            </div>
          }
          onLoadError={(error) => setPdfError(error.message)}
          onLoadSuccess={({ numPages: loadedPages }) => {
            setPdfError(null);
            setNumPages(loadedPages);
          }}
        >
          {isThumbnailPanelOpen && (
            <aside
              className="interactive-reader__thumbnails"
              aria-label="Bảng hình thu nhỏ PDF"
            >
              <div className="interactive-reader__thumbnails-header">
                <h3>Hình thu nhỏ</h3>
                <button
                  type="button"
                  onClick={() => setIsThumbnailPanelOpen(false)}
                  aria-label="Đóng hình thu nhỏ"
                  title="Đóng hình thu nhỏ"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
              <div className="interactive-reader__thumbnails-grid">
                {pages.map((pageNumber) => (
                  <button
                    type="button"
                    key={pageNumber}
                    className="interactive-reader__thumbnail"
                    onClick={() => flipToPage(pageNumber - 1)}
                    aria-label={`Đến trang ${pageNumber}`}
                    aria-current={pageNumber === currentPage ? "page" : undefined}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={92}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      className="interactive-reader__thumbnail-page"
                    />
                    <span>Trang {pageNumber}</span>
                  </button>
                ))}
              </div>
            </aside>
          )}
          {numPages > 0 && (
            <div className="interactive-reader__book-shell">
              <FlipbookStage
                key={resolvedPdfPath}
                numPages={numPages}
                bookRef={bookRef}
                pageWidth={bookWidth}
                width={bookWidth}
                height={bookHeight}
                maxWidth={bookMaxWidth}
                maxHeight={bookMaxHeight}
                onFlip={handleFlip}
              />
            </div>
          )}
        </Document>
      </div>
      <audio
        ref={pageFlipAudioRef}
        src={resolvedPageFlipSoundPath}
        aria-label="Hiệu ứng âm thanh lật trang"
        preload="auto"
      />
      <audio
        ref={narrationAudioRef}
        aria-label="Âm thanh đọc văn bản"
        preload="auto"
      />
    </section>
  );
}
