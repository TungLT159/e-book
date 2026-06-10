import { ArrowLeft, Images, Maximize, Menu, Minimize, Pause, Play, Settings, SkipBack, SkipForward, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';

type NarrationVoiceOption = {
  value: string;
  label: string;
};

type InteractivePdfFlipbookMenuProps = {
  title: string;
  onBackToLibrary?: () => void;
  currentPage: number;
  numPages: number;
  isMenuOpen: boolean;
  menuToggleRef: RefObject<HTMLButtonElement | null>;
  menuPanelRef: RefObject<HTMLElement | null>;
  toggleMenu: () => void;
  isFullscreen: boolean;
  zoom: number;
  changeZoom: (direction: 1 | -1) => void;
  toggleFullscreen: () => void;
  toggleThumbnails: () => void;
  isTtsSettingsOpen: boolean;
  toggleTtsSettings: () => void;
  closeTtsSettings: () => void;
  isVoiceLoading: boolean;
  voiceOptions: NarrationVoiceOption[];
  selectedVoice: string;
  setSelectedVoice: Dispatch<SetStateAction<string>>;
  speechRate: number;
  setSpeechRate: Dispatch<SetStateAction<number>>;
  isNarrationEnabled: boolean;
  isNarrationLoading: boolean;
  isNarrationSynthesizing: boolean;
  toggleNarration: () => void;
  isAutoFlipEnabled: boolean;
  setIsAutoFlipEnabled: Dispatch<SetStateAction<boolean>>;
  currentPageIndex: number;
  flipToPage: (pageIndex: number) => void;
  narrationError: string | null;
};

export function InteractivePdfFlipbookMenu({
  title,
  onBackToLibrary,
  currentPage,
  numPages,
  isMenuOpen,
  menuToggleRef,
  menuPanelRef,
  toggleMenu,
  isFullscreen,
  zoom,
  changeZoom,
  toggleFullscreen,
  toggleThumbnails,
  isTtsSettingsOpen,
  toggleTtsSettings,
  closeTtsSettings,
  isVoiceLoading,
  voiceOptions,
  selectedVoice,
  setSelectedVoice,
  speechRate,
  setSpeechRate,
  isNarrationEnabled,
  isNarrationLoading,
  isNarrationSynthesizing,
  toggleNarration,
  isAutoFlipEnabled,
  setIsAutoFlipEnabled,
  currentPageIndex,
  flipToPage,
  narrationError,
}: InteractivePdfFlipbookMenuProps) {
  return (
    <>
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
        <p className="interactive-reader__status">Trang {currentPage} / {numPages || '-'}</p>

        <button
          type="button"
          className="interactive-reader__menu-toggle"
          ref={menuToggleRef}
          onClick={toggleMenu}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? 'Đóng menu điều khiển' : 'Mở menu điều khiển'}
          title={isMenuOpen ? 'Đóng menu điều khiển' : 'Mở menu điều khiển'}
        >
          {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>

      {isMenuOpen && (
        <nav
          ref={menuPanelRef}
          className="interactive-reader__menu-panel"
          role="navigation"
          aria-label="Menu điều khiển trình đọc"
          data-state="open"
          style={{ position: 'absolute', zIndex: 40 }}
        >
          <div className="interactive-reader__menu-sections">
            <div className="menu-section menu-section--view">
              <h3 className="menu-section__title">View</h3>
              <button type="button" onClick={() => changeZoom(1)} disabled={zoom >= 1.35} aria-label="Phóng to" title="Phóng to">
                <ZoomIn aria-hidden="true" />
                Phóng to
              </button>
              <button type="button" onClick={() => changeZoom(-1)} disabled={zoom <= 0.8} aria-label="Thu nhỏ" title="Thu nhỏ">
                <ZoomOut aria-hidden="true" />
                Thu nhỏ
              </button>
              <button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'} title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>
                {isFullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
                {isFullscreen ? 'Thoát' : 'Toàn màn hình'}
              </button>
              <button type="button" onClick={toggleThumbnails} aria-label="Hình thu nhỏ" title="Hình thu nhỏ">
                <Images aria-hidden="true" />
                Hình thu nhỏ
              </button>
            </div>

            <div className="menu-section menu-section--audio">
              <h3 className="menu-section__title">Audio & Tools</h3>
              <button
                type="button"
                onClick={toggleNarration}
                disabled={!numPages || isNarrationLoading}
                aria-label={isNarrationSynthesizing ? 'Đang tạo giọng đọc' : isNarrationEnabled ? 'Dừng đọc' : 'Đọc tự động'}
                title={isNarrationSynthesizing ? 'Đang tạo giọng đọc' : isNarrationEnabled ? 'Dừng đọc' : 'Đọc tự động'}
              >
                {isNarrationEnabled ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                {isNarrationSynthesizing ? 'Đang tạo giọng đọc...' : isNarrationEnabled ? 'Dừng đọc' : 'Đọc tự động'}
              </button>

              <div style={{ position: 'relative' }}>
                <button type="button" onClick={toggleTtsSettings} aria-label="Cài đặt TTS" title="Cài đặt TTS" aria-expanded={isTtsSettingsOpen}>
                  <Settings aria-hidden="true" />
                  Cài đặt TTS
                </button>

                {isTtsSettingsOpen && (
                  <div className="interactive-reader__tts-submenu" aria-label="Cài đặt TTS">
                    <div className="interactive-reader__tts-submenu-header">
                      <h4>Cài đặt TTS</h4>
                      <button type="button" className="interactive-reader__tts-submenu-close" onClick={closeTtsSettings} aria-label="Đóng" title="Đóng">
                        <X aria-hidden="true" />
                      </button>
                    </div>

                    <label className="interactive-reader__tts-field">
                      <span>Giọng đọc</span>
                      <select value={selectedVoice} onChange={(event) => setSelectedVoice(event.target.value)} disabled={isVoiceLoading || voiceOptions.length === 0} aria-label="Giọng đọc">
                        {voiceOptions.map((voice) => (
                          <option key={voice.value} value={voice.value}>{voice.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="interactive-reader__tts-field">
                      <span>Tốc độ đọc</span>
                      <input type="range" min={-50} max={50} step={5} value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))} aria-label="Tốc độ đọc" />
                      <output aria-live="polite">{speechRate === 0 ? 'Bình thường' : `${speechRate > 0 ? '+' : ''}${speechRate}%`}</output>
                    </label>
                  </div>
                )}
              </div>

              <button type="button" onClick={() => setIsAutoFlipEnabled((prev) => !prev)} disabled={!numPages || currentPageIndex >= numPages - 1} aria-label={isAutoFlipEnabled ? 'Dừng tự lật' : 'Tự lật trang'} title={isAutoFlipEnabled ? 'Dừng tự lật' : 'Tự lật trang'}>
                {isAutoFlipEnabled ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                {isAutoFlipEnabled ? 'Dừng tự lật' : 'Tự lật'}
              </button>

              <button type="button" onClick={() => flipToPage(0)} disabled={!numPages || currentPageIndex <= 0} aria-label="Trang đầu" title="Trang đầu">
                <SkipBack aria-hidden="true" />
                Trang đầu
              </button>

              <button type="button" onClick={() => flipToPage(numPages - 1)} disabled={!numPages || currentPageIndex >= numPages - 1} aria-label="Trang cuối" title="Trang cuối">
                <SkipForward aria-hidden="true" />
                Trang cuối
              </button>
            </div>
          </div>
        </nav>
      )}
    </>
  );
}
