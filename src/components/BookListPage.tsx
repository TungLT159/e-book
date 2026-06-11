import { BookOpen, FileText, Filter, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PdfBookState } from '../hooks/usePdfBookLoader';
import type { ReadingProgressRecord } from '../types/electron';
import { resolvePublicAssetPath } from '../utils/publicAsset';
import { CustomSelect, type CustomSelectOption } from './CustomSelect';

type BookListPageProps = {
  books: PdfBookState[];
  loading?: boolean;
  onSelectBook: (bookId: string) => void;
  progressByBookId?: Record<string, ReadingProgressRecord>;
};

type SearchFilters = {
  query: string;
  subject: string;
  ageRange: string;
  keyword: string;
};

type SearchOptions = {
  subjects: string[];
  ageRanges: string[];
  keywords: string[];
};

type ScoredBook = {
  book: PdfBookState;
  score: number;
  activeCriteria: number;
  index: number;
};

const fallbackCoverColors: [string, string] = ['#2a5d6b', '#f4a261'];
const isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
    .trim();
}

function uniqueReadableValues(values: string[]) {
  const seen = new Set<string>();

  return values.reduce<string[]>((result, value) => {
    const readableValue = value.trim();
    const normalizedValue = normalizeSearchText(readableValue);
    if (normalizedValue && !seen.has(normalizedValue)) {
      seen.add(normalizedValue);
      result.push(readableValue);
    }
    return result;
  }, []);
}

function getBookSearchText(book: PdfBookState) {
  return normalizeSearchText(
    [book.config.title, book.config.subject, ...(book.config.keywords ?? [])].join(' '),
  );
}

function getSearchOptions(books: PdfBookState[]): SearchOptions {
  return {
    subjects: uniqueReadableValues(books.map((book) => book.config.subject ?? '')),
    ageRanges: uniqueReadableValues(books.map((book) => book.config.ageRange ?? '')),
    keywords: uniqueReadableValues(books.flatMap((book) => book.config.keywords ?? [])),
  };
}

function getSuggestions(books: PdfBookState[], query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }
  const values = uniqueReadableValues(
    books.flatMap((book) => [
      book.config.title,
      book.config.subject ?? '',
      ...(book.config.keywords ?? []),
    ]),
  );

  return values.filter((value) => normalizeSearchText(value).includes(normalizedQuery));
}

function getBookMatchScore(book: PdfBookState, filters: SearchFilters, index: number): ScoredBook {
  const normalizedFilters = {
    query: normalizeSearchText(filters.query),
    subject: normalizeSearchText(filters.subject),
    ageRange: normalizeSearchText(filters.ageRange),
    keyword: normalizeSearchText(filters.keyword),
  };
  const criteria = [
    normalizedFilters.query
      ? getBookSearchText(book).includes(normalizedFilters.query)
      : null,
    normalizedFilters.subject
      ? normalizeSearchText(book.config.subject ?? '') === normalizedFilters.subject
      : null,
    normalizedFilters.ageRange
      ? normalizeSearchText(book.config.ageRange ?? '') === normalizedFilters.ageRange
      : null,
    normalizedFilters.keyword
      ? (book.config.keywords ?? []).some(
          (keyword) => normalizeSearchText(keyword) === normalizedFilters.keyword,
        )
      : null,
  ];
  const activeMatches = criteria.filter((criterion): criterion is boolean => criterion !== null);

  return {
    book,
    score: activeMatches.filter(Boolean).length,
    activeCriteria: activeMatches.length,
    index,
  };
}

type BookCardProps = {
  book: PdfBookState;
  onSelectBook: (bookId: string) => void;
  progress?: ReadingProgressRecord;
};

function isValidProgressRecord(progress: ReadingProgressRecord | undefined, bookId: string) {
  return Boolean(
    progress
      && progress.bookId === bookId
      && Number.isInteger(progress.lastPageIndex)
      && progress.lastPageIndex >= 0
      && Number.isFinite(progress.progressPercent)
      && progress.progressPercent >= 0
      && progress.progressPercent <= 100
      && typeof progress.completed === 'boolean'
      && typeof progress.lastOpenedAt === 'string'
      && progress.lastOpenedAt.trim().length > 0
      && isoTimestampPattern.test(progress.lastOpenedAt)
      && Number.isFinite(Date.parse(progress.lastOpenedAt)),
  );
}

function BookCard({ book, onSelectBook, progress }: BookCardProps) {
  const [hasThumbnailError, setHasThumbnailError] = useState(false);
  const [startColor, endColor] = book.config.coverColors ?? fallbackCoverColors;
  const validProgress = isValidProgressRecord(progress, book.config.id) ? progress : undefined;
  const progressLabel = validProgress?.completed
    ? 'Đã hoàn thành'
    : validProgress
      ? `${validProgress.progressPercent}%. Tiếp tục từ trang ${validProgress.lastPageIndex + 1}`
      : '';

  return (
    <button
      type="button"
      className="book-card"
      aria-label={`Đọc sách: ${book.config.title}${progressLabel ? `. ${progressLabel}` : ''}`}
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
        {validProgress?.completed ? (
          <span className="book-card__meta">Đã hoàn thành</span>
        ) : validProgress ? (
          <>
            <span className="book-card__meta">{validProgress.progressPercent}%</span>
            <span className="book-card__meta">Tiếp tục từ trang {validProgress.lastPageIndex + 1}</span>
          </>
        ) : null}
      </span>
    </button>
  );
}

export function BookListPage({ books, loading = false, onSelectBook, progressByBookId }: BookListPageProps) {
  const [query, setQuery] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedAgeRange, setSelectedAgeRange] = useState('');
  const [selectedKeyword, setSelectedKeyword] = useState('');
  const normalizedQuery = normalizeSearchText(query);
  const searchOptions = useMemo(() => getSearchOptions(books), [books]);
  const subjectOptions = useMemo<CustomSelectOption[]>(
    () => [
      { value: '', label: 'Tất cả chủ đề' },
      ...searchOptions.subjects.map((subject) => ({ value: subject, label: subject })),
    ],
    [searchOptions.subjects],
  );
  const ageRangeOptions = useMemo<CustomSelectOption[]>(
    () => [
      { value: '', label: 'Tất cả độ tuổi' },
      ...searchOptions.ageRanges.map((ageRange) => ({ value: ageRange, label: ageRange })),
    ],
    [searchOptions.ageRanges],
  );
  const keywordOptions = useMemo<CustomSelectOption[]>(
    () => [
      { value: '', label: 'Tất cả từ khóa' },
      ...searchOptions.keywords.map((keyword) => ({ value: keyword, label: keyword })),
    ],
    [searchOptions.keywords],
  );
  const suggestions = useMemo(() => getSuggestions(books, query), [books, query]);
  const filters = useMemo<SearchFilters>(
    () => ({
      query,
      subject: selectedSubject,
      ageRange: selectedAgeRange,
      keyword: selectedKeyword,
    }),
    [query, selectedSubject, selectedAgeRange, selectedKeyword],
  );
  const scoredBooks = useMemo(
    () => books.map((book, index) => getBookMatchScore(book, filters, index)),
    [books, filters],
  );
  const hasActiveCriteria = scoredBooks.some(({ activeCriteria }) => activeCriteria > 0);
  const primaryBooks = useMemo(
    () => scoredBooks.filter(({ score, activeCriteria }) => score === activeCriteria).map(({ book }) => book),
    [scoredBooks],
  );
  const relatedBooks = useMemo(
    () =>
      scoredBooks
        .filter(({ score, activeCriteria }) => activeCriteria > 0 && score > 0 && score < activeCriteria)
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .map(({ book }) => book),
    [scoredBooks],
  );

  function clearSearch() {
    setQuery('');
    setSelectedSubject('');
    setSelectedAgeRange('');
    setSelectedKeyword('');
  }

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
        <>
          <div className="book-list-page__discovery">
            <div className="book-list-page__search-bar">
              <label className="book-list-page__search-label">
                <span className="book-list-page__search-label-text">Tìm sách</span>
                <Search className="book-list-page__search-icon" aria-hidden="true" />
                <input
                  className="book-list-page__search-input"
                  type="search"
                  value={query}
                  placeholder="Tìm theo tên sách, chủ đề, từ khóa..."
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button
                className="book-list-page__search-action book-list-page__search-action--filter"
                type="button"
                aria-label={isFilterPanelOpen ? 'Đóng bộ lọc' : 'Mở bộ lọc'}
                aria-expanded={isFilterPanelOpen}
                aria-controls="book-list-filters"
                onClick={() => setIsFilterPanelOpen((isOpen) => !isOpen)}
              >
                <Filter className="book-list-page__control-icon" aria-hidden="true" />
              </button>
              {normalizedQuery || selectedSubject || selectedAgeRange || selectedKeyword ? (
                <button
                  className="book-list-page__search-action book-list-page__search-action--clear"
                  type="button"
                  aria-label="Xóa tìm kiếm và bộ lọc"
                  onClick={clearSearch}
                >
                  <X className="book-list-page__control-icon" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {suggestions.length > 0 ? (
              <div className="book-list-page__suggestions" aria-label="Gợi ý tìm kiếm">
                {suggestions.map((suggestion) => (
                  <button
                    key={normalizeSearchText(suggestion)}
                    className="book-list-page__suggestion"
                    type="button"
                    aria-label={`Tìm theo gợi ý: ${suggestion}`}
                    onClick={() => setQuery(suggestion)}
                  >
                    <Search className="book-list-page__control-icon" aria-hidden="true" />
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            {isFilterPanelOpen ? (
              <div id="book-list-filters" className="book-list-page__filters">
                <CustomSelect
                  className="book-list-page__filter-field"
                  label="Chủ đề"
                  value={selectedSubject}
                  options={subjectOptions}
                  onChange={setSelectedSubject}
                />
                <CustomSelect
                  className="book-list-page__filter-field"
                  label="Độ tuổi"
                  value={selectedAgeRange}
                  options={ageRangeOptions}
                  onChange={setSelectedAgeRange}
                />
                <CustomSelect
                  className="book-list-page__filter-field"
                  label="Từ khóa"
                  value={selectedKeyword}
                  options={keywordOptions}
                  onChange={setSelectedKeyword}
                />
              </div>
            ) : null}
          </div>

          <section className="book-list-page__results" aria-label="Kết quả phù hợp">
            {primaryBooks.length > 0 ? (
              <div className="book-list-page__grid">
                {primaryBooks.map((book) => (
                  <BookCard
                    key={book.config.id}
                    book={book}
                    onSelectBook={onSelectBook}
                    progress={progressByBookId?.[book.config.id]}
                  />
                ))}
              </div>
            ) : relatedBooks.length > 0 ? (
              <p className="book-list-page__empty book-list-page__search-empty book-list-page__search-empty--partial book-list-page__search-empty-message">
                Không tìm thấy sách khớp tất cả bộ lọc.
              </p>
            ) : (
              <div className="book-list-page__empty book-list-page__search-empty">
                <p className="book-list-page__search-empty-message">Không tìm thấy sách phù hợp.</p>
                <button className="book-list-page__empty-action" type="button" onClick={clearSearch}>
                  Xóa tìm kiếm và bộ lọc
                </button>
              </div>
            )}
          </section>

          {hasActiveCriteria && relatedBooks.length > 0 ? (
            <section className="book-list-page__related" aria-labelledby="related-results-heading">
              <h2 className="book-list-page__related-heading" id="related-results-heading">Kết quả liên quan</h2>
              <div className="book-list-page__grid">
                {relatedBooks.map((book) => (
                  <BookCard
                    key={book.config.id}
                    book={book}
                    onSelectBook={onSelectBook}
                    progress={progressByBookId?.[book.config.id]}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
