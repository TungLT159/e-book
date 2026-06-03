import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PdfBookConfig } from '../data/pdfBooks';
import { BookListPage } from './BookListPage';

const mockBooks: PdfBookConfig[] = [
  {
    id: 'book-1',
    title: 'Sách thứ nhất',
    pdfPath: '/books/book1.pdf',
    audioPath: '/books/book1.mp3',
    timeline: [{ page: 1, start: 0, end: 10 }],
    coverColors: ['#e8825c', '#c94b4b'],
  },
  {
    id: 'book-2',
    title: 'Ngủ ngon nhé',
    pdfPath: '/books/book2.pdf',
    audioPath: '',
    timeline: [{ page: 1, start: 0, end: 5 }],
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

  it('renders page count for books with timeline entries', () => {
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    expect(screen.getAllByText('1 trang')).toHaveLength(2);
  });

  it('renders empty state when no books are available', () => {
    render(<BookListPage books={[]} onSelectBook={vi.fn()} />);

    expect(screen.getByText('Chưa có sách nào.')).toBeInTheDocument();
  });

  it('renders cover initials', () => {
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('N')).toBeInTheDocument();
  });

  it('renders a book without coverColors using the fallback path', () => {
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Đọc sách: Ngủ ngon nhé' })).toBeInTheDocument();
  });

  it('renders empty timeline text when a book has no pages', () => {
    render(
      <BookListPage
        books={[{ ...mockBooks[0], id: 'empty-book', timeline: [] }]}
        onSelectBook={vi.fn()}
      />,
    );

    expect(screen.getByText('Không có trang')).toBeInTheDocument();
  });
});
