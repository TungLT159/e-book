import { memo } from 'react';
import type { RefObject } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Page } from 'react-pdf';

const FLIPPING_TIME = 650;

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
  onInit?: () => void;
};

export const FlipbookStage = memo(function FlipbookStage({
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
