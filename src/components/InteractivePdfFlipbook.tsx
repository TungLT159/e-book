import { memo } from 'react';
import type { CSSProperties, RefObject } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Images,
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
} from 'lucide-react';
import HTMLFlipBook from 'react-pageflip';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDF_WORKER_URL } from '../hooks/pdfWorker';
import { useInteractivePdfFlipbook } from './hooks/useInteractivePdfFlipbook';
import { resolvePublicAssetPath } from '../utils/publicAsset';
import type { ReadingProgressRecord } from '../types/electron';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

type FlipbookStageProps = {
  numPages: number;
  bookRef: RefObject<{ pageFlip: () => { flip: (pageIndex: number) => void; flipNext: () => void; flipPrev: () => void; update?: () => void } } | null>;
  pageWidth: number;
  width: number;
  height: number;
  maxWidth: number;
  maxHeight: number;
  onFlip: (event: { data: number }) => void;
  onInit?: () => void;
};

type InteractivePdfFlipbookProps = {
  title: string;
  pdfPath: string;
  bookId?: string;
  savedProgress?: ReadingProgressRecord | null;
  isReadingProgressLoaded?: boolean;
  onProgressChange?: (payload: ReadingProgressRecord) => void;
  onBackToLibrary?: () => void;
} & Record<string, unknown>;

const FlipbookStage = memo(function FlipbookStage({
  numPages,
  bookRef,
  pageWidth,
  width,
  height,
  maxWidth,
  maxHeight,
  onFlip,
  onInit,
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
      flippingTime={650}
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
      style={{ width: '100%', height: '100%' }}
      onFlip={onFlip}
      onInit={onInit}
    >
      {pages.map((pageNumber) => {
        const isFrontCover = pageNumber === 1;
        const isBackCover = pageNumber === numPages;
        const pageClassName = [
          'interactive-reader__page',
          isFrontCover && 'interactive-reader__page--front-cover',
          isBackCover && 'interactive-reader__page--back-cover',
        ]
          .filter(Boolean)
          .join(' ');

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
  bookId,
  savedProgress,
  isReadingProgressLoaded = true,
  onProgressChange,
  onBackToLibrary,
}: InteractivePdfFlipbookProps) {
  const state = useInteractivePdfFlipbook({
    title,
    pdfPath,
    bookId,
    savedProgress,
    isReadingProgressLoaded,
    onProgressChange,
  });

  return (
    <section
      ref={state.readerRef}
      className="interactive-reader"
      aria-label={`Trình đọc tương tác cho ${title}`}
      style={{ '--interactive-reader-zoom': state.readerZoom } as CSSProperties}
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
          Trang {state.currentPage} / {state.numPages || '-'}
        </p>

        <button
          type="button"
          className="interactive-reader__menu-toggle"
          ref={state.menuToggleRef}
          onClick={state.toggleMenu}
          aria-expanded={state.isMenuOpen}
          aria-label={state.isMenuOpen ? 'Đóng menu điều khiển' : 'Mở menu điều khiển'}
          title={state.isMenuOpen ? 'Đóng menu điều khiển' : 'Mở menu điều khiển'}
        >
          {state.isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>

      <div className="interactive-reader__shell">
        {state.isMenuOpen && (
          <nav
            ref={state.menuPanelRef}
            className="interactive-reader__menu-panel"
            role="navigation"
            aria-label="Menu điều khiển trình đọc"
            data-state="open"
            style={{ position: 'absolute', zIndex: 40 }}
          >
            <div className="interactive-reader__menu-sections">
              <div className="menu-section menu-section--view">
                <h3 className="menu-section__title">View</h3>
                <button type="button" onClick={() => state.changeZoom(1)} disabled={state.zoom >= 1.35} aria-label="Phóng to" title="Phóng to">
                  <ZoomIn aria-hidden="true" />
                  Phóng to
                </button>
                <button type="button" onClick={() => state.changeZoom(-1)} disabled={state.zoom <= 0.8} aria-label="Thu nhỏ" title="Thu nhỏ">
                  <ZoomOut aria-hidden="true" />
                  Thu nhỏ
                </button>
                <button type="button" onClick={state.toggleFullscreen} aria-label={state.isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'} title={state.isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>
                  {state.isFullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
                  {state.isFullscreen ? 'Thoát' : 'Toàn màn hình'}
                </button>
                <button type="button" onClick={state.toggleThumbnails} aria-label="Hình thu nhỏ" title="Hình thu nhỏ">
                  <Images aria-hidden="true" />
                  Hình thu nhỏ
                </button>
              </div>

              <div className="menu-section menu-section--audio">
                <h3 className="menu-section__title">Audio & Tools</h3>
                <button
                  type="button"
                  onClick={state.toggleNarration}
                  disabled={!state.numPages || state.isNarrationLoading}
                  aria-label={state.isNarrationSynthesizing ? 'Đang tạo giọng đọc' : state.isNarrationEnabled ? 'Dừng đọc' : 'Đọc tự động'}
                  title={state.isNarrationSynthesizing ? 'Đang tạo giọng đọc' : state.isNarrationEnabled ? 'Dừng đọc' : 'Đọc tự động'}
                >
                  {state.isNarrationEnabled ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  {state.isNarrationSynthesizing ? 'Đang tạo giọng đọc...' : state.isNarrationEnabled ? 'Dừng đọc' : 'Đọc tự động'}
                </button>

                <div style={{ position: 'relative' }}>
                  <button type="button" onClick={state.toggleTtsSettings} aria-label="Cài đặt TTS" title="Cài đặt TTS" aria-expanded={state.isTtsSettingsOpen}>
                    <Settings aria-hidden="true" />
                    Cài đặt TTS
                  </button>

                  {state.isTtsSettingsOpen && (
                    <div className="interactive-reader__tts-submenu" aria-label="Cài đặt TTS">
                      <div className="interactive-reader__tts-submenu-header">
                        <h4>Cài đặt TTS</h4>
                        <button type="button" className="interactive-reader__tts-submenu-close" onClick={state.closeTtsSettings} aria-label="Đóng" title="Đóng">
                          <X aria-hidden="true" />
                        </button>
                      </div>

                      <label className="interactive-reader__tts-field">
                        <span>Giọng đọc</span>
                        <select value={state.selectedVoice} onChange={(event) => state.setSelectedVoice(event.target.value)} disabled={state.isVoiceLoading || state.voiceOptions.length === 0} aria-label="Giọng đọc">
                          {state.voiceOptions.map((voice) => (
                            <option key={voice.value} value={voice.value}>
                              {voice.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="interactive-reader__tts-field">
                        <span>Tốc độ đọc</span>
                        <input type="range" min={-50} max={50} step={5} value={state.speechRate} onChange={(event) => state.setSpeechRate(Number(event.target.value))} aria-label="Tốc độ đọc" />
                        <output aria-live="polite">{state.speechRate === 0 ? 'Bình thường' : `${state.speechRate > 0 ? '+' : ''}${state.speechRate}%`}</output>
                      </label>
                    </div>
                  )}
                </div>

                <button type="button" onClick={() => state.setIsAutoFlipEnabled((prev) => !prev)} disabled={!state.numPages || state.currentPageIndex >= state.numPages - 1} aria-label={state.isAutoFlipEnabled ? 'Dừng tự lật' : 'Tự lật trang'} title={state.isAutoFlipEnabled ? 'Dừng tự lật' : 'Tự lật trang'}>
                  {state.isAutoFlipEnabled ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  {state.isAutoFlipEnabled ? 'Dừng tự lật' : 'Tự lật'}
                </button>

                <button type="button" onClick={() => state.flipToPage(0)} disabled={!state.numPages || state.currentPageIndex <= 0} aria-label="Trang đầu" title="Trang đầu">
                  <SkipBack aria-hidden="true" />
                  Trang đầu
                </button>

                <button type="button" onClick={() => state.flipToPage(state.numPages - 1)} disabled={!state.numPages || state.currentPageIndex >= state.numPages - 1} aria-label="Trang cuối" title="Trang cuối">
                  <SkipForward aria-hidden="true" />
                  Trang cuối
                </button>
              </div>
            </div>
          </nav>
        )}

        {state.narrationError && <p className="interactive-reader__message interactive-reader__message--error">{state.narrationError}</p>}

        {state.isNarrationEnabled && (
          <div className="interactive-reader__auto-read-bar">
            {state.isAutoReadPreparing ? (
              <div className="interactive-reader__auto-read-loading" role="status" aria-label="Trạng thái đọc tự động" aria-live="polite">
                <span className="interactive-reader__auto-read-spinner" aria-hidden="true" />
                Đang tạo giọng đọc...
              </div>
            ) : (
              <div className="interactive-reader__auto-read-controls" role="group" aria-label="Điều khiển đọc tự động">
                <button type="button" className="interactive-reader__auto-read-button" onClick={() => state.readNarrationPage(state.narrationPageIndex - 1)} disabled={state.narrationPageIndex <= 0} aria-label="Đọc trang trước" title="Đọc trang trước">
                  <SkipBack aria-hidden="true" />
                  Prev
                </button>
                <button type="button" className="interactive-reader__auto-read-button interactive-reader__auto-read-button--primary" onClick={state.toggleNarrationPlayback} aria-label={state.isNarrationPaused ? 'Tiếp tục đọc' : 'Tạm dừng đọc'} title={state.isNarrationPaused ? 'Tiếp tục đọc' : 'Tạm dừng đọc'}>
                  {state.isNarrationPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                  {state.isNarrationPaused ? 'Tiếp tục' : 'Tạm dừng'}
                </button>
                <button type="button" className="interactive-reader__auto-read-button" onClick={() => state.readNarrationPage(state.narrationPageIndex + 1)} disabled={!state.numPages || state.narrationPageIndex >= state.numPages - 1} aria-label="Đọc trang tiếp theo" title="Đọc trang tiếp theo">
                  <SkipForward aria-hidden="true" />
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        <button type="button" className="interactive-reader__nav interactive-reader__nav--prev" onClick={state.flipToPreviousPage} disabled={state.currentPageIndex <= 0} aria-label="Trang trước" title="Trang trước">
          <ChevronLeft aria-hidden="true" />
        </button>
        <button type="button" className="interactive-reader__nav interactive-reader__nav--next" onClick={state.flipToNextPage} disabled={!state.numPages || state.currentPageIndex >= state.numPages - 1} aria-label="Trang tiếp theo" title="Trang tiếp theo">
          <ChevronRight aria-hidden="true" />
        </button>

        <Document
          className="interactive-reader__document"
          file={state.resolvedPdfPath}
          loading={<p className="interactive-reader__message">Đang tải PDF...</p>}
          error={
            <div className="interactive-reader__message interactive-reader__message--error">
              <p>Không thể tải PDF.</p>
              {state.pdfError && <p>{state.pdfError}</p>}
              <p>Đường dẫn: {state.resolvedPdfPath}</p>
            </div>
          }
          onLoadError={(error) => state.setPdfError(error.message)}
          onLoadSuccess={({ numPages: loadedPages }) => {
            state.setPdfError(null);
            state.setNumPages(loadedPages);
          }}
        >
          {state.isThumbnailPanelOpen && (
            <aside className="interactive-reader__thumbnails" aria-label="Bảng hình thu nhỏ PDF">
              <div className="interactive-reader__thumbnails-header">
                <h3>Hình thu nhỏ</h3>
                <button type="button" onClick={() => state.setIsThumbnailPanelOpen(false)} aria-label="Đóng hình thu nhỏ" title="Đóng hình thu nhỏ">
                  <X aria-hidden="true" />
                </button>
              </div>
              <div className="interactive-reader__thumbnails-grid">
                {state.pages.map((pageNumber) => (
                  <button type="button" key={pageNumber} className="interactive-reader__thumbnail" onClick={() => state.flipToPage(pageNumber - 1)} aria-label={`Đến trang ${pageNumber}`} aria-current={pageNumber === state.currentPage ? 'page' : undefined}>
                    <Page pageNumber={pageNumber} width={92} renderAnnotationLayer={false} renderTextLayer={false} className="interactive-reader__thumbnail-page" />
                    <span>Trang {pageNumber}</span>
                  </button>
                ))}
              </div>
            </aside>
          )}
          {state.numPages > 0 && (
            <div className="interactive-reader__book-shell">
              <FlipbookStage
                key={state.resolvedPdfPath}
                numPages={state.numPages}
                bookRef={state.bookRef}
                pageWidth={state.bookWidth}
                width={state.bookWidth}
                height={state.bookHeight}
                maxWidth={state.bookMaxWidth}
                maxHeight={state.bookMaxHeight}
                onFlip={state.handleFlip}
                onInit={state.onFlipbookInit}
              />
            </div>
          )}
        </Document>
      </div>
      <audio ref={state.pageFlipAudioRef} src={state.resolvedPageFlipSoundPath} aria-label="Hiệu ứng âm thanh lật trang" preload="auto" />
      <audio ref={state.narrationAudioRef} aria-label="Âm thanh đọc văn bản" preload="auto" />
    </section>
  );
}

export { resolvePublicAssetPath };
