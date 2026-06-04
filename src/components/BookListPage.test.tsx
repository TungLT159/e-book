import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PdfBookState } from '../hooks/usePdfBookLoader';
import { BookListPage } from './BookListPage';

const mockBooks: PdfBookState[] = [
  {
    config: {
      id: 'book-1',
      title: 'Sách thứ nhất',
      pdfPath: '/books/book1.pdf',
      thumbnail: '/books/book1.png',
      pageCount: 3,
      ageRange: '12+',
      subject: 'Test',
      keywords: [],
      favorite: false,
      coverColors: ['#e8825c', '#c94b4b'],
    },
    pages: [
      { id: 1, title: 'Page 1', image: 'blob:1', thumbnail: 'blob:1' },
      { id: 2, title: 'Page 2', image: 'blob:2', thumbnail: 'blob:2' },
      { id: 3, title: 'Page 3', image: 'blob:3', thumbnail: 'blob:3' },
    ],
    loaded: true,
  },
  {
    config: {
      id: 'book-2',
      title: 'Ngủ ngon nhé',
      pdfPath: '/books/book2.pdf',
      thumbnail: '/books/book2.png',
      pageCount: 1,
      ageRange: '12+',
      subject: 'Test',
      keywords: [],
      favorite: true,
    },
    pages: [{ id: 1, title: 'Page 1', image: 'blob:4', thumbnail: 'blob:4' }],
    loaded: true,
  },
];

describe('BookListPage', () => {
  it('renders the header and all book titles', () => {
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    expect(screen.getByText('Thư viện sách')).toBeInTheDocument();
    expect(screen.getByText('Chọn một cuốn sách để đọc')).toBeInTheDocument();
    expect(screen.getByText('Sách thứ nhất')).toBeInTheDocument();
    expect(screen.getByText('Ngủ ngon nhé')).toBeInTheDocument();
  });

  it('calls onSelectBook with the selected book id', async () => {
    const user = userEvent.setup();
    const onSelectBook = vi.fn();
    render(<BookListPage books={mockBooks} onSelectBook={onSelectBook} />);

    await user.click(screen.getByRole('button', { name: 'Đọc sách: Ngủ ngon nhé' }));

    expect(onSelectBook).toHaveBeenCalledWith('book-2');
  });

  it('renders page count for loaded books', () => {
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    expect(screen.getByText('3 trang')).toBeInTheDocument();
    expect(screen.getByText('1 trang')).toBeInTheDocument();
  });

  it('renders empty state when no books are available', () => {
    render(<BookListPage books={[]} onSelectBook={vi.fn()} />);

    expect(screen.getByText('Chưa có sách nào.')).toBeInTheDocument();
  });

  it('renders thumbnail covers and falls back to initials on error', () => {
    const { container } = render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    const coverImage = container.querySelector('.book-card__cover-image') as HTMLImageElement;
    expect(coverImage).toHaveAttribute('src', '/books/book1.png');

    fireEvent.error(coverImage);

    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('renders a book without coverColors using the fallback path', () => {
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Đọc sách: Ngủ ngon nhé' })).toBeInTheDocument();
  });

  it('renders the configured page count even without rendered pages', () => {
    render(
      <BookListPage
        books={[{ ...mockBooks[0], config: { ...mockBooks[0].config, id: 'empty-book' }, pages: [], loaded: true }]}
        onSelectBook={vi.fn()}
      />,
    );

    expect(screen.getByText('3 trang')).toBeInTheDocument();
  });

  it('shows loading copy before any books are available', () => {
    render(<BookListPage books={[]} loading onSelectBook={vi.fn()} />);

    expect(screen.getByText('Đang tải thư viện sách...')).toBeInTheDocument();
  });
});
