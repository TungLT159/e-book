type ToolbarProps = {
  currentPage: number;
  totalPages: number;
  zoom: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFullscreen: () => void;
};

export function Toolbar({
  currentPage,
  totalPages,
  zoom,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFullscreen,
}: ToolbarProps) {
  return (
    <div className="toolbar" aria-label="Flipbook controls">
      <button type="button" onClick={onPrevious} disabled={!canGoPrevious} aria-label="Previous page">
        Previous
      </button>
      <span className="toolbar__status">Page {currentPage} / {totalPages}</span>
      <button type="button" onClick={onNext} disabled={!canGoNext} aria-label="Next page">
        Next
      </button>
      <span className="toolbar__divider" aria-hidden="true" />
      <button type="button" onClick={onZoomOut} aria-label="Zoom out">-</button>
      <button type="button" onClick={onResetZoom} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
      <button type="button" onClick={onZoomIn} aria-label="Zoom in">+</button>
      <span className="toolbar__divider" aria-hidden="true" />
      <button type="button" onClick={onFullscreen} aria-label="Fullscreen">Fullscreen</button>
    </div>
  );
}
