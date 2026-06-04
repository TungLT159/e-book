import { BookOpen, FileText } from 'lucide-react';
import { useState } from 'react';
import type { PdfBookState } from '../hooks/usePdfBookLoader';
import { resolvePublicAssetPath } from '../utils/publicAsset';

type BookListPageProps = {
  books: PdfBookState[];
  loading?: boolean;
  onSelectBook: (bookId: string) => void;
};

const fallbackCoverColors: [string, string] = ['#2a5d6b', '#f4a261'];

type BookCardProps = {
  book: PdfBookState;
  onSelectBook: (bookId: string) => void;
};

function BookCard({ book, onSelectBook }: BookCardProps) {
  const [hasThumbnailError, setHasThumbnailError] = useState(false);
  const [startColor, endColor] = book.config.coverColors ?? fallbackCoverColors;

  return (
    <button
      type="button"
      className="book-card"
      aria-label={`Đọc sách: ${book.config.title}`}
      onClick={() => onSelectBook(book.config.id)}
    >
      <span
        className="book-card__cover"
        style={{ background: `linear-gradient(135deg, ${startColor}, ${endColor})` }}
      >
        {!hasThumbnailError ? (
          <img
            className="book-card__cover-image"
            src={resolvePublicAssetPath(book.config.thumbnail)}
            alt=""
            loading="lazy"
            onError={() => setHasThumbnailError(true)}
          />
        ) : (
          <span className="book-card__initial">{book.config.title.charAt(0).toUpperCase()}</span>
        )}
      </span>
      <span className="book-card__info">
        <span className="book-card__title">{book.config.title}</span>
        <span className="book-card__meta">
          <FileText aria-hidden="true" />
          {book.config.pageCount} trang
        </span>
      </span>
    </button>
  );
}

export function BookListPage({ books, loading = false, onSelectBook }: BookListPageProps) {
  return (
    <main className="book-list-page">
      <header className="book-list-page__header">
        <BookOpen aria-hidden="true" />
        <h1 className="book-list-page__title">Thư viện sách</h1>
        <p className="book-list-page__subtitle">Chọn một cuốn sách để đọc</p>
      </header>

      {loading && books.length === 0 ? (
        <p className="book-list-page__empty">Đang tải thư viện sách...</p>
      ) : books.length === 0 ? (
        <p className="book-list-page__empty">Chưa có sách nào.</p>
      ) : (
        <div className="book-list-page__grid">
          {books.map((book) => (
            <BookCard key={book.config.id} book={book} onSelectBook={onSelectBook} />
          ))}
        </div>
      )}
    </main>
  );
}
