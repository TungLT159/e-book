import type { PdfBookState } from '../hooks/usePdfBookLoader';

type BookSelectorProps = {
  books: PdfBookState[];
  activeBookId: string;
  onSelectBook: (id: string) => void;
};

export function BookSelector({ books, activeBookId, onSelectBook }: BookSelectorProps) {
  if (books.length === 0) return null;

  return (
    <nav className="book-selector" aria-label="Book selection">
      {books.map((book) => {
        const isActive = book.config.id === activeBookId;
        return (
          <button
            key={book.config.id}
            type="button"
            className={`book-selector__item${isActive ? ' book-selector__item--active' : ''}`}
            onClick={() => onSelectBook(book.config.id)}
            aria-current={isActive ? 'page' : undefined}
            disabled={!book.loaded && !book.error}
          >
            {!book.loaded && !book.error && (
              <span className="book-selector__spinner" aria-label="Loading" />
            )}
            <span className="book-selector__initials">
              {book.config.title.charAt(0).toUpperCase()}
            </span>
            <span className="book-selector__title">{book.config.title}</span>
            {book.loaded && (
              <span className="book-selector__count">{book.pages.length} p.</span>
            )}
            {book.error && (
              <span className="book-selector__error" title={book.error}>Error</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
