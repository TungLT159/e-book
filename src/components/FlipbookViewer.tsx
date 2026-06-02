import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import HTMLFlipBook from 'react-pageflip';
import type { BookPage } from '../data/bookPages';
import { ThumbnailStrip } from './ThumbnailStrip';
import { Toolbar } from './Toolbar';

type PageFlipApi = {
  flipNext: () => void;
  flipPrev: () => void;
  flip: (pageIndex: number) => void;
};

type PageFlipRef = {
  pageFlip: () => PageFlipApi;
};

type FlipbookViewerProps = {
  pages: BookPage[];
};

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

export function FlipbookViewer({ pages }: FlipbookViewerProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const bookRef = useRef<PageFlipRef | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);

  const totalPages = pages.length;
  const currentPage = currentPageIndex + 1;

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));

  const goPrevious = () => {
    bookRef.current?.pageFlip().flipPrev();
  };

  const goNext = () => {
    bookRef.current?.pageFlip().flipNext();
  };

  const selectPage = (pageIndex: number) => {
    bookRef.current?.pageFlip().flip(pageIndex);
    setCurrentPageIndex(pageIndex);
  };

  const enterFullscreen = () => {
    void viewerRef.current?.requestFullscreen?.();
  };

  return (
    <section className="viewer" ref={viewerRef}>
      <Toolbar
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        canGoPrevious={currentPageIndex > 0}
        canGoNext={currentPageIndex < totalPages - 1}
        onPrevious={goPrevious}
        onNext={goNext}
        onZoomIn={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
        onZoomOut={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
        onResetZoom={() => setZoom(1)}
        onFullscreen={enterFullscreen}
      />
      <div className="viewer__workspace">
        <ThumbnailStrip pages={pages} currentPageIndex={currentPageIndex} onSelectPage={selectPage} />
        <div className="viewer__book-stage" style={{ '--book-zoom': zoom } as CSSProperties}>
          <HTMLFlipBook
            ref={bookRef}
            startPage={0}
            width={420}
            height={580}
            size="stretch"
            minWidth={280}
            maxWidth={520}
            minHeight={390}
            maxHeight={720}
            drawShadow={true}
            flippingTime={850}
            usePortrait={true}
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
            className="viewer__book"
            style={{}}
            onFlip={(event: { data: number }) => setCurrentPageIndex(event.data)}
          >
            {pages.map((page) => (
              <article className="viewer__page" key={page.id}>
                <img src={page.image} alt={page.title} loading={page.id === 1 ? 'eager' : 'lazy'} />
                <span className="viewer__image-fallback">Could not load {page.title}</span>
              </article>
            ))}
          </HTMLFlipBook>
        </div>
      </div>
    </section>
  );
}
