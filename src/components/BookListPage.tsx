import { BookOpen, Headphones } from 'lucide-react';
import type { PdfBookConfig } from '../data/pdfBooks';

type BookListPageProps = {
  books: PdfBookConfig[];
  onSelectBook: (bookId: string) => void;
};

const fallbackCoverColors: [string, string] = ['#2a5d6b', '#f4a261'];

export function BookListPage({ books, onSelectBook }: BookListPageProps) {
  return (
    <main className="book-list-page">
      <header className="book-list-page__header">
        <BookOpen aria-hidden="true" />
        <h1 className="book-list-page__title">Thư viện sách</h1>
        <p className="book-list-page__subtitle">Chọn một cuốn sách để đọc</p>
      </header>

      {books.length === 0 ? (
        <p className="book-list-page__empty">Chưa có sách nào.</p>
      ) : (
        <div className="book-list-page__grid">
          {books.map((book) => {
            const [startColor, endColor] = book.coverColors ?? fallbackCoverColors;
            const pageCount = book.timeline.length;

            return (
              <button
                key={book.id}
                type="button"
                className="book-card"
                aria-label={`Đọc sách: ${book.title}`}
                onClick={() => onSelectBook(book.id)}
              >
                <span
                  className="book-card__cover"
                  style={{ background: `linear-gradient(135deg, ${startColor}, ${endColor})` }}
                >
                  <span className="book-card__initial">{book.title.charAt(0).toUpperCase()}</span>
                </span>
                <span className="book-card__info">
                  <span className="book-card__title">{book.title}</span>
                  <span className="book-card__meta">
                    <Headphones aria-hidden="true" />
                    {pageCount > 0 ? `${pageCount} trang` : 'Không có trang'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
