import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
const FLIPPING_TIME = 650;
const PAGE_FLIP_SOUND_PATH = "/Audio/effects/page-flip.mp3";
const NARRATION_VOICE = "vi-VN-HoaiMyNeural";
const DEFAULT_NARRATION_RATE = 0;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 1.35;
const ZOOM_STEP = 0.1;
const FULLSCREEN_ZOOM_MULTIPLIER = 1.18;
const AUTO_FLIP_INTERVAL = 3200;

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

type NarrationVoiceOption = {
  value: string;
  label: string;
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

  return sanitized.replace(/\s+/g, " ").trim();
}

const FlipbookStage = memo(function FlipbookStage({
  numPages,
  bookRef,
  onFlip,
}: FlipbookStageProps) {
  const pages = Array.from({ length: numPages }, (_, index) => index + 1);

  return (
    <HTMLFlipBook
      ref={bookRef}
      startPage={0}
      width={PDF_PAGE_WIDTH}
      height={720}
      size="stretch"
      minWidth={320}
      maxWidth={PDF_PAGE_WIDTH}
      minHeight={440}
      maxHeight={720}
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
              width={PDF_PAGE_WIDTH}
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
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoFlipEnabled, setIsAutoFlipEnabled] = useState(false);
  const [isThumbnailPanelOpen, setIsThumbnailPanelOpen] = useState(false);
  const [isNarrationEnabled, setIsNarrationEnabled] = useState(false);
  const [isNarrationLoading, setIsNarrationLoading] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceOptions, setVoiceOptions] = useState<NarrationVoiceOption[]>([
    { value: NARRATION_VOICE, label: "Hoài My (vi-VN)" },
  ]);
  const [selectedVoice, setSelectedVoice] = useState(NARRATION_VOICE);
  const [speechRate, setSpeechRate] = useState(DEFAULT_NARRATION_RATE);
  const [pageNarrationTexts, setPageNarrationTexts] = useState<string[]>([]);
  const [narrationError, setNarrationError] = useState<string | null>(null);
  const readerRef = useRef<HTMLElement | null>(null);
  const bookRef = useRef<PageFlipRef | null>(null);
  const pageFlipAudioRef = useRef<HTMLAudioElement | null>(null);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastSyncedPageRef = useRef(1);
  const flipSettledTimeoutRef = useRef<number | null>(null);
  const narrationBlobUrlRef = useRef<string | null>(null);
  const narrationRequestIdRef = useRef(0);

  const currentPage = currentPageIndex + 1;
  const pages = Array.from({ length: numPages }, (_, index) => index + 1);
  const resolvedPdfPath = resolvePublicAssetPath(pdfPath);
  const resolvedPageFlipSoundPath =
    resolvePublicAssetPath(PAGE_FLIP_SOUND_PATH);
  const readerZoom = zoom * (isFullscreen ? FULLSCREEN_ZOOM_MULTIPLIER : 1);

  const formatNarrationRate = useCallback((rate: number) => {
    if (rate === 0) return undefined;
    return `${rate > 0 ? "+" : ""}${rate}%`;
  }, []);

  const playPageFlipSound = useCallback(() => {
    const sound = pageFlipAudioRef.current;
    if (!sound) return;

    sound.currentTime = 0;
    void sound.play().catch(() => undefined);
  }, []);

  const stopNarration = useCallback(() => {
    narrationRequestIdRef.current += 1;

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
  }, []);

  const extractTextFromPdf = useCallback(async () => {
    if (!numPages) {
      return [] as string[];
    }

    const pdf = await getDocument({ url: resolvedPdfPath }).promise;
    const texts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");

      texts.push(sanitizeNarrationText(pageText));
    }

    return texts;
  }, [numPages, resolvedPdfPath]);

  const setVisiblePage = useCallback((pageIndex: number) => {
    const nextPage = pageIndex + 1;
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
      setIsMenuOpen(false);
      setIsThumbnailPanelOpen(false);
    },
    [numPages, setVisiblePage],
  );

  const flipToPreviousPage = useCallback(() => {
    if (currentPageIndex <= 0) return;

    bookRef.current?.pageFlip().flipPrev();
  }, [currentPageIndex]);

  const flipToNextPage = useCallback(() => {
    if (!numPages || currentPageIndex >= numPages - 1) return;

    bookRef.current?.pageFlip().flipNext();
  }, [currentPageIndex, numPages]);

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

  const toggleReaderMenu = useCallback(() => {
    setIsThumbnailPanelOpen(false);
    setIsMenuOpen((isOpen) => !isOpen);
  }, []);

  const toggleThumbnails = useCallback(() => {
    setIsThumbnailPanelOpen((isOpen) => !isOpen);
    setIsMenuOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (flipSettledTimeoutRef.current !== null) {
        window.clearTimeout(flipSettledTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setPageNarrationTexts([]);
    setNarrationError(null);
    setIsNarrationLoading(Boolean(numPages));
    setIsNarrationEnabled(false);
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
          setVoiceOptions([{ value: NARRATION_VOICE, label: "Hoài My (vi-VN)" }]);
          setSelectedVoice((currentVoice) => currentVoice || NARRATION_VOICE);
          return;
        }

        const mappedVoices = voices
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
          setVoiceOptions([{ value: NARRATION_VOICE, label: "Hoài My (vi-VN)" }]);
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      setIsMenuOpen(false);
      setIsThumbnailPanelOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isNarrationEnabled || !numPages || isNarrationLoading || narrationError) {
      return undefined;
    }

    const narrationText = sanitizeNarrationText(pageNarrationTexts[currentPageIndex] || "");
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

      if (currentPageIndex >= numPages - 1) {
        setIsNarrationEnabled(false);
        return;
      }

      flipToNextPage();
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

        const audioData = await edgeTts.synthesize(narrationText, narrationOptions);

        if (cancelled || requestId !== narrationRequestIdRef.current) {
          return;
        }

        const blobSource =
          audioData instanceof Uint8Array
            ? new Uint8Array(audioData).buffer
            : audioData;
        const blob = new Blob([blobSource], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        if (narrationBlobUrlRef.current) {
          URL.revokeObjectURL(narrationBlobUrlRef.current);
        }
        narrationBlobUrlRef.current = url;

        audio.src = url;
        audio.currentTime = 0;
        await audio.play();
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
      }
    })();

    return () => {
      cancelled = true;
      cleanupAudio();
    };
  }, [
    currentPageIndex,
    flipToNextPage,
    isNarrationEnabled,
    isNarrationLoading,
    narrationError,
    numPages,
    pageNarrationTexts,
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
      </header>

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

      <div className="interactive-reader__menu-shell">
        <button
          type="button"
          className="interactive-reader__menu-toggle"
          onClick={toggleReaderMenu}
          aria-expanded={isMenuOpen}
          aria-label={
            isMenuOpen ? "Đóng menu điều khiển" : "Mở menu điều khiển"
          }
          title={isMenuOpen ? "Đóng menu điều khiển" : "Mở menu điều khiển"}
        >
          <Menu aria-hidden="true" />
        </button>
        {isMenuOpen && (
          <div
            className="interactive-reader__menu"
            aria-label="Menu điều khiển trình đọc"
          >
            <button
              type="button"
              onClick={() => changeZoom(1)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Phóng to"
              title="Phóng to"
            >
              <ZoomIn aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => changeZoom(-1)}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Thu nhỏ"
              title="Thu nhỏ"
            >
              <ZoomOut aria-hidden="true" />
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
            </button>
            <button
              type="button"
              onClick={() => {
                setNarrationError(null);
                setIsNarrationEnabled((isEnabled) => !isEnabled);
              }}
              disabled={!numPages || isNarrationLoading}
              aria-label={isNarrationEnabled ? "Dừng đọc" : "Đọc tự động"}
              title={isNarrationEnabled ? "Dừng đọc" : "Đọc tự động"}
            >
              {isNarrationEnabled ? (
                <Pause aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
            </button>
            <div className="interactive-reader__tts-settings">
              <label className="interactive-reader__tts-field">
                <span>Giọng đọc</span>
                <select
                  value={selectedVoice}
                  onChange={(event) => setSelectedVoice(event.target.value)}
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
                  onChange={(event) => setSpeechRate(Number(event.target.value))}
                  aria-label="Tốc độ đọc"
                />
                <output aria-live="polite">
                  {speechRate === 0 ? "Bình thường" : `${speechRate > 0 ? "+" : ""}${speechRate}%`}
                </output>
              </label>
            </div>
            <button
              type="button"
              onClick={() => setIsAutoFlipEnabled((isEnabled) => !isEnabled)}
              disabled={!numPages || currentPageIndex >= numPages - 1}
              aria-label={isAutoFlipEnabled ? "Dừng tự lật" : "Tự lật trang"}
              title={isAutoFlipEnabled ? "Dừng tự lật" : "Tự lật trang"}
            >
              {isAutoFlipEnabled ? (
                <Pause aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleThumbnails}
              aria-label="Hình thu nhỏ"
              title="Hình thu nhỏ"
            >
              <Images aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => flipToPage(0)}
              disabled={!numPages || currentPageIndex <= 0}
              aria-label="Trang đầu"
              title="Trang đầu"
            >
              <SkipBack aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => flipToPage(numPages - 1)}
              disabled={!numPages || currentPageIndex >= numPages - 1}
              aria-label="Trang cuối"
              title="Trang cuối"
            >
              <SkipForward aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

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
              numPages={numPages}
              bookRef={bookRef}
              onFlip={handleFlip}
            />
          </div>
        )}
      </Document>
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
