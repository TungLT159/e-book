import { Page } from 'react-pdf';
import { X } from 'lucide-react';

type InteractivePdfFlipbookThumbnailsProps = {
  isThumbnailPanelOpen: boolean;
  pages: number[];
  currentPage: number;
  flipToPage: (pageIndex: number) => void;
  closeThumbnails: () => void;
};

export function InteractivePdfFlipbookThumbnails({
  isThumbnailPanelOpen,
  pages,
  currentPage,
  flipToPage,
  closeThumbnails,
}: InteractivePdfFlipbookThumbnailsProps) {
  if (!isThumbnailPanelOpen) return null;

  return (
    <aside className="interactive-reader__thumbnails" aria-label="Bảng hình thu nhỏ PDF">
      <div className="interactive-reader__thumbnails-header">
        <h3>Hình thu nhỏ</h3>
        <button type="button" onClick={closeThumbnails} aria-label="Đóng hình thu nhỏ" title="Đóng hình thu nhỏ">
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
            aria-current={pageNumber === currentPage ? 'page' : undefined}
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
  );
}
