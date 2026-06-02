import type { BookPage } from '../data/bookPages';

type ThumbnailStripProps = {
  pages: BookPage[];
  currentPageIndex: number;
  onSelectPage: (pageIndex: number) => void;
};

export function ThumbnailStrip({ pages, currentPageIndex, onSelectPage }: ThumbnailStripProps) {
  return (
    <aside className="thumbnail-strip" aria-label="Page thumbnails">
      {pages.map((page, index) => (
        <button
          type="button"
          className="thumbnail-strip__item"
          key={page.id}
          onClick={() => onSelectPage(index)}
          aria-label={`Go to ${page.title}`}
          aria-current={index === currentPageIndex ? 'page' : undefined}
        >
          <img src={page.thumbnail} alt="" loading="lazy" />
          <span>{page.id}</span>
        </button>
      ))}
    </aside>
  );
}
