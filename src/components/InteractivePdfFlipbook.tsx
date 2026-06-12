import { CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Document } from 'react-pdf';
import { FlipbookStage } from './FlipbookStage';
import { InteractivePdfFlipbookAudio } from './InteractivePdfFlipbookAudio';
import { InteractivePdfFlipbookMenu } from './InteractivePdfFlipbookMenu';
import { InteractivePdfFlipbookThumbnails } from './InteractivePdfFlipbookThumbnails';
import { useInteractivePdfFlipbook } from './hooks/useInteractivePdfFlipbook';
import type { ReadingProgressRecord } from '../types/electron';

type InteractivePdfFlipbookProps = {
  title: string;
  pdfPath: string;
  onBackToLibrary?: () => void;
  bookId?: string;
  savedProgress?: ReadingProgressRecord | null;
  isReadingProgressLoaded?: boolean;
  onProgressChange?: (payload: ReadingProgressRecord) => void;
} & Record<string, unknown>;

function formatSleepTimer(remainingSeconds: number) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function InteractivePdfFlipbook({
  title,
  pdfPath,
  onBackToLibrary,
  bookId,
  savedProgress,
  isReadingProgressLoaded,
  onProgressChange,
}: InteractivePdfFlipbookProps) {
  const state = useInteractivePdfFlipbook({
    title,
    pdfPath,
    bookId,
    savedProgress: savedProgress as never,
    isReadingProgressLoaded,
    onProgressChange: onProgressChange as never,
  });

  return (
    <section
      ref={state.readerRef}
      className="interactive-reader"
      aria-label={`Trình đọc tương tác cho ${title}`}
      style={{ '--interactive-reader-zoom': state.readerZoom } as CSSProperties}
    >
      <InteractivePdfFlipbookMenu
        title={title}
        onBackToLibrary={onBackToLibrary}
        currentPage={state.currentPage}
        numPages={state.numPages}
        isMenuOpen={state.isMenuOpen}
        menuToggleRef={state.menuToggleRef}
        menuPanelRef={state.menuPanelRef}
        toggleMenu={state.toggleMenu}
        isFullscreen={state.isFullscreen}
        zoom={state.zoom}
        changeZoom={state.changeZoom}
        toggleFullscreen={state.toggleFullscreen}
        toggleThumbnails={state.toggleThumbnails}
        isTtsSettingsOpen={state.isTtsSettingsOpen}
        toggleTtsSettings={state.toggleTtsSettings}
        closeTtsSettings={state.closeTtsSettings}
        isVoiceLoading={state.isVoiceLoading}
        voiceOptions={state.voiceOptions}
        selectedVoice={state.selectedVoice}
        setSelectedVoice={state.setSelectedVoice}
        speechRate={state.speechRate}
        setSpeechRate={state.setSpeechRate}
        speechVolume={state.speechVolume}
        setSpeechVolume={state.setSpeechVolume}
        sleepTimerMinutes={state.sleepTimerMinutes}
        setSleepTimerMinutes={state.setSleepTimerMinutes}
        isNarrationEnabled={state.isNarrationEnabled}
        isNarrationLoading={state.isNarrationLoading}
        isNarrationSynthesizing={state.isNarrationSynthesizing}
        toggleNarration={state.toggleNarration}
        isAutoFlipEnabled={state.isAutoFlipEnabled}
        setIsAutoFlipEnabled={state.setIsAutoFlipEnabled}
        currentPageIndex={state.currentPageIndex}
        flipToPage={state.flipToPage}
        narrationError={state.narrationError}
      />

      <div className="interactive-reader__shell">
        {state.narrationError && (
          <p className="interactive-reader__message interactive-reader__message--error">
            {state.narrationError}
          </p>
        )}

        {state.isNarrationEnabled && (
          <div className="interactive-reader__auto-read-bar">
            {state.sleepTimerRemainingSeconds !== null && (
              <span
                className="interactive-reader__sleep-timer"
                aria-label="Thời gian đọc còn lại"
                aria-live="off"
              >
                {formatSleepTimer(state.sleepTimerRemainingSeconds)}
              </span>
            )}
            {state.isAutoReadPreparing ? (
              <div
                className="interactive-reader__auto-read-loading"
                role="status"
                aria-label="Trạng thái đọc tự động"
                aria-live="polite"
              >
                <span
                  className="interactive-reader__auto-read-spinner"
                  aria-hidden="true"
                />
                Đang tạo giọng đọc...
              </div>
            ) : (
              <div
                className="interactive-reader__auto-read-controls"
                role="group"
                aria-label="Điều khiển đọc tự động"
              >
                <button
                  type="button"
                  className="interactive-reader__auto-read-button"
                  onClick={() => state.readNarrationPage(state.narrationPageIndex - 1)}
                  disabled={state.narrationPageIndex <= 0}
                  aria-label="Đọc trang trước"
                  title="Đọc trang trước"
                >
                  <ChevronLeft aria-hidden="true" />
                  Prev
                </button>
                <button
                  type="button"
                  className="interactive-reader__auto-read-button interactive-reader__auto-read-button--primary"
                  onClick={state.toggleNarrationPlayback}
                  aria-label={state.isNarrationPaused ? 'Tiếp tục đọc' : 'Tạm dừng đọc'}
                  title={state.isNarrationPaused ? 'Tiếp tục đọc' : 'Tạm dừng đọc'}
                >
                  {state.isNarrationPaused ? (
                    <ChevronRight aria-hidden="true" />
                  ) : (
                    <ChevronLeft aria-hidden="true" />
                  )}
                  {state.isNarrationPaused ? 'Tiếp tục' : 'Tạm dừng'}
                </button>
                <button
                  type="button"
                  className="interactive-reader__auto-read-button"
                  onClick={() => state.readNarrationPage(state.narrationPageIndex + 1)}
                  disabled={!state.numPages || state.narrationPageIndex >= state.numPages - 1}
                  aria-label="Đọc trang tiếp theo"
                  title="Đọc trang tiếp theo"
                >
                  <ChevronRight aria-hidden="true" />
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="interactive-reader__nav interactive-reader__nav--prev"
          onClick={state.flipToPreviousPage}
          disabled={state.currentPageIndex <= 0}
          aria-label="Trang trước"
          title="Trang trước"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className="interactive-reader__nav interactive-reader__nav--next"
          onClick={state.flipToNextPage}
          disabled={!state.numPages || state.currentPageIndex >= state.numPages - 1}
          aria-label="Trang tiếp theo"
          title="Trang tiếp theo"
        >
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
          <InteractivePdfFlipbookThumbnails
            isThumbnailPanelOpen={state.isThumbnailPanelOpen}
            pages={state.pages}
            currentPage={state.currentPage}
            flipToPage={state.flipToPage}
            closeThumbnails={() => state.setIsThumbnailPanelOpen(false)}
          />

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

      <InteractivePdfFlipbookAudio
        pageFlipAudioRef={state.pageFlipAudioRef}
        narrationAudioRef={state.narrationAudioRef}
        resolvedPageFlipSoundPath={state.resolvedPageFlipSoundPath}
      />
    </section>
  );
}

export { resolvePublicAssetPath } from '../utils/publicAsset';
