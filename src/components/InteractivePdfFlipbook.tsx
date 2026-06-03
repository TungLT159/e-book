import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ChevronLeft,
  ChevronRight,
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
import { PDF_WORKER_URL } from "../hooks/pdfWorker";
import type { AudioTimelineItem } from "../data/pdfBooks";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

const PDF_PAGE_WIDTH = 660;
const FLIPPING_TIME = 650;
const PAGE_FLIP_SOUND_PATH = "/Audio/effects/page-flip.mp3";
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 1.35;
const ZOOM_STEP = 0.1;
const AUTO_FLIP_INTERVAL = 3200;

type PageFlipApi = {
  flipNext: () => void;
  flipPrev: () => void;
  flip: (pageIndex: number) => void;
};

type PageFlipRef = {
  pageFlip: () => PageFlipApi;
};

type InteractivePdfFlipbookProps = {
  title: string;
  pdfPath: string;
  audioPath: string;
  timeline: AudioTimelineItem[];
  onBackToLibrary?: () => void;
};

export function resolvePublicAssetPath(
  path: string,
  baseUrl = import.meta.env.BASE_URL,
) {
  if (/^(https?:|blob:|data:)/.test(path)) return path;

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, "");

  return `${normalizedBase}${normalizedPath}`;
}

export function InteractivePdfFlipbook({
  title,
  pdfPath,
  audioPath,
  timeline,
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
  const readerRef = useRef<HTMLElement | null>(null);
  const bookRef = useRef<PageFlipRef | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pageFlipAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastSyncedPageRef = useRef(1);
  const flipSettledTimeoutRef = useRef<number | null>(null);

  const currentPage = currentPageIndex + 1;
  const pages = Array.from({ length: numPages }, (_, index) => index + 1);
  const resolvedPdfPath = resolvePublicAssetPath(pdfPath);
  const resolvedAudioPath = resolvePublicAssetPath(audioPath);
  const resolvedPageFlipSoundPath =
    resolvePublicAssetPath(PAGE_FLIP_SOUND_PATH);

  const playPageFlipSound = useCallback(() => {
    const sound = pageFlipAudioRef.current;
    if (!sound) return;

    sound.currentTime = 0;
    void sound.play().catch(() => undefined);
  }, []);

  const setVisiblePage = useCallback((pageIndex: number) => {
    const nextPage = pageIndex + 1;
    lastSyncedPageRef.current = nextPage;
    setCurrentPageIndex(pageIndex);
  }, []);

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

  const toggleReaderMenu = useCallback(() => {
    setIsThumbnailPanelOpen(false);
    setIsMenuOpen((isOpen) => !isOpen);
  }, []);

  const toggleThumbnails = useCallback(() => {
    setIsThumbnailPanelOpen((isOpen) => !isOpen);
    setIsMenuOpen(false);
  }, []);

  const syncPageToAudio = useCallback(() => {
    const currentTime = audioRef.current?.currentTime ?? 0;
    const activeTimelineItem = timeline.find(
      (item) => currentTime >= item.start && currentTime < item.end,
    );

    if (
      !activeTimelineItem ||
      activeTimelineItem.page === lastSyncedPageRef.current
    ) {
      return;
    }

    const targetPage = Math.min(
      Math.max(activeTimelineItem.page, 1),
      numPages || activeTimelineItem.page,
    );
    const targetPageIndex = targetPage - 1;

    bookRef.current?.pageFlip().flip(targetPageIndex);
    setVisiblePage(targetPageIndex);
  }, [numPages, setVisiblePage, timeline]);

  useEffect(() => {
    return () => {
      if (flipSettledTimeoutRef.current !== null) {
        window.clearTimeout(flipSettledTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === readerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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
      style={{ "--interactive-reader-zoom": zoom } as CSSProperties}
    >
      <header className="interactive-reader__header">
        <h2>{title}</h2>
        <p className="interactive-reader__status">
          Trang {currentPage} / {numPages || "-"}
        </p>
      </header>

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
          aria-label={isMenuOpen ? "Đóng menu điều khiển" : "Mở menu điều khiển"}
          title={isMenuOpen ? "Đóng menu điều khiển" : "Mở menu điều khiển"}
        >
          <Menu aria-hidden="true" />
        </button>
        {isMenuOpen && (
          <div className="interactive-reader__menu" aria-label="Menu điều khiển trình đọc">
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
              aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
              title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            >
              {isFullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => setIsAutoFlipEnabled((isEnabled) => !isEnabled)}
              disabled={!numPages || currentPageIndex >= numPages - 1}
              aria-label={isAutoFlipEnabled ? "Dừng tự lật" : "Tự lật trang"}
              title={isAutoFlipEnabled ? "Dừng tự lật" : "Tự lật trang"}
            >
              {isAutoFlipEnabled ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={toggleThumbnails}
              aria-label="Hình thu nhỏ"
              title="Hình thu nhỏ"
            >
              <Images aria-hidden="true" />
            </button>
            {onBackToLibrary && (
              <button
                type="button"
                onClick={onBackToLibrary}
                aria-label="Về thư viện"
                title="Về thư viện"
              >
                <Library aria-hidden="true" />
              </button>
            )}
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
          <aside className="interactive-reader__thumbnails" aria-label="Bảng hình thu nhỏ PDF">
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
            autoSize={true}
            maxShadowOpacity={0.24}
            showCover={true}
            mobileScrollSupport={true}
            clickEventForward={true}
            useMouseEvents={true}
            swipeDistance={30}
            showPageCorners={true}
            disableFlipByClick={false}
            renderOnlyPageLengthChange={true}
            className="interactive-reader__book"
            style={{ width: "100%", height: "100%" }}
            onFlip={(event: { data: number }) => {
              playPageFlipSound();
              if (flipSettledTimeoutRef.current !== null) {
                window.clearTimeout(flipSettledTimeoutRef.current);
              }
              flipSettledTimeoutRef.current = window.setTimeout(() => {
                setVisiblePage(event.data);
                flipSettledTimeoutRef.current = null;
              }, FLIPPING_TIME);
            }}
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
        )}
      </Document>
      <audio
        ref={audioRef}
        className="interactive-reader__audio"
        src={resolvedAudioPath}
        controls
        aria-label={`Âm thanh kể chuyện cho ${title}`}
        onTimeUpdate={syncPageToAudio}
      />
      <audio
        ref={pageFlipAudioRef}
        src={resolvedPageFlipSoundPath}
        aria-label="Hiệu ứng âm thanh lật trang"
        preload="auto"
      />
    </section>
  );
}
