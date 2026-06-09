import { fireEvent, render, screen, within } from '@testing-library/react';
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
      ageRange: '6+',
      subject: 'Cổ tích',
      keywords: ['bạn bè', 'can đảm'],
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
      ageRange: '3+',
      subject: 'Kỹ năng sống',
      keywords: ['giấc ngủ', 'bé cún'],
      favorite: true,
    },
    pages: [{ id: 1, title: 'Page 1', image: 'blob:4', thumbnail: 'blob:4' }],
    loaded: true,
  },
  {
    config: {
      id: 'book-3',
      title: 'Sóc không hề tham lam',
      pdfPath: '/books/book3.pdf',
      thumbnail: '/books/book3.png',
      pageCount: 20,
      ageRange: '6+',
      subject: 'Kỹ năng sống',
      keywords: ['chia sẻ', 'tham lam'],
      favorite: false,
    },
    pages: Array.from({ length: 20 }, (_, index) => ({
      id: index + 1,
      title: `Page ${index + 1}`,
      image: `blob:${index + 5}`,
      thumbnail: `blob:${index + 5}`,
    })),
    loaded: true,
  },
];

describe('BookListPage', () => {
  it('renders the header and all book titles', () => {
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);
    const primaryResults = screen.getByRole('region', { name: 'Kết quả phù hợp' });

    expect(screen.getByText('Thư viện sách')).toBeInTheDocument();
    expect(screen.getByText('Chọn một cuốn sách để đọc')).toBeInTheDocument();
    expect(within(primaryResults).getByText('Sách thứ nhất')).toBeInTheDocument();
    expect(within(primaryResults).getByText('Ngủ ngon nhé')).toBeInTheDocument();
    expect(within(primaryResults).getByText('Sóc không hề tham lam')).toBeInTheDocument();
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

  it('matches a title query without requiring diacritics', async () => {
    const user = userEvent.setup();
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    await user.type(screen.getByRole('searchbox', { name: 'Tìm sách' }), 'ngu ngon');
    const primaryResults = screen.getByRole('region', { name: 'Kết quả phù hợp' });

    expect(within(primaryResults).getByText('Ngủ ngon nhé')).toBeInTheDocument();
    expect(within(primaryResults).queryByText('Sách thứ nhất')).not.toBeInTheDocument();
    expect(within(primaryResults).queryByText('Sóc không hề tham lam')).not.toBeInTheDocument();
  });

  it('treats a whitespace-only query as inactive', async () => {
    const user = userEvent.setup();
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    await user.type(screen.getByRole('searchbox', { name: 'Tìm sách' }), '   ');
    const primaryResults = screen.getByRole('region', { name: 'Kết quả phù hợp' });

    expect(within(primaryResults).getAllByRole('button', { name: /Đọc sách:/ })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Xóa tìm kiếm và bộ lọc' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Gợi ý tìm kiếm')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Kết quả liên quan' })).not.toBeInTheDocument();
  });

  it('searches book keywords as primary results', async () => {
    const user = userEvent.setup();
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    await user.type(screen.getByRole('searchbox', { name: 'Tìm sách' }), 'chia sẻ');

    expect(screen.getByText('Sóc không hề tham lam')).toBeInTheDocument();
    expect(screen.queryByText('Sách thứ nhất')).not.toBeInTheDocument();
    expect(screen.queryByText('Ngủ ngon nhé')).not.toBeInTheDocument();
  });

  it('shows strict filter matches separately from related partial matches', async () => {
    const user = userEvent.setup();
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Mở bộ lọc' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chủ đề' }), 'Kỹ năng sống');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Độ tuổi' }), '6+');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Từ khóa' }), 'chia sẻ');

    const primaryResults = screen.getByRole('region', { name: 'Kết quả phù hợp' });
    const relatedResults = screen.getByRole('region', { name: 'Kết quả liên quan' });

    expect(within(primaryResults).getByText('Sóc không hề tham lam')).toBeInTheDocument();
    expect(within(primaryResults).queryByText('Ngủ ngon nhé')).not.toBeInTheDocument();
    expect(within(relatedResults).getByText('Sách thứ nhất')).toBeInTheDocument();
    expect(within(relatedResults).getByText('Ngủ ngon nhé')).toBeInTheDocument();
    expect(within(relatedResults).queryByText('Sóc không hề tham lam')).not.toBeInTheDocument();
  });

  it('shows related books when active filters have no strict result', async () => {
    const user = userEvent.setup();
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Mở bộ lọc' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chủ đề' }), 'Kỹ năng sống');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Độ tuổi' }), '6+');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Từ khóa' }), 'giấc ngủ');

    expect(screen.getByText(/không tìm thấy/i)).toBeInTheDocument();
    const relatedResults = screen.getByRole('region', { name: 'Kết quả liên quan' });
    expect(within(relatedResults).getByText('Sóc không hề tham lam')).toBeInTheDocument();
    expect(within(relatedResults).getByText('Ngủ ngon nhé')).toBeInTheDocument();
    expect(within(relatedResults).getByText('Sách thứ nhất')).toBeInTheDocument();
  });

  it('orders related books by score descending and then catalog order', async () => {
    const user = userEvent.setup();
    const orderingBooks: PdfBookState[] = [
      {
        ...mockBooks[0],
        config: { ...mockBooks[0].config, id: 'score-1-first', title: 'Điểm một đầu', subject: 'Chung', ageRange: '3+' },
      },
      {
        ...mockBooks[1],
        config: { ...mockBooks[1].config, id: 'score-2', title: 'Điểm hai', subject: 'Chung', ageRange: '6+' },
      },
      {
        ...mockBooks[2],
        config: { ...mockBooks[2].config, id: 'score-1-last', title: 'Điểm một sau', subject: 'Khác', ageRange: '6+' },
      },
    ];
    render(<BookListPage books={orderingBooks} onSelectBook={vi.fn()} />);

    await user.type(screen.getByRole('searchbox', { name: 'Tìm sách' }), 'không có');
    await user.click(screen.getByRole('button', { name: 'Mở bộ lọc' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chủ đề' }), 'Chung');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Độ tuổi' }), '6+');
    const relatedRegion = screen.getByRole('region', { name: 'Kết quả liên quan' });

    expect(
      within(relatedRegion)
        .getAllByRole('button', { name: /Đọc sách:/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Đọc sách: Điểm hai', 'Đọc sách: Điểm một đầu', 'Đọc sách: Điểm một sau']);
  });

  it('applies a subject suggestion to the search query', async () => {
    const user = userEvent.setup();
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);
    const searchbox = screen.getByRole('searchbox', { name: 'Tìm sách' });

    await user.type(searchbox, 'ky nang');
    await user.click(screen.getByRole('button', { name: 'Tìm theo gợi ý: Kỹ năng sống' }));
    const primaryResults = screen.getByRole('region', { name: 'Kết quả phù hợp' });

    expect(searchbox).toHaveValue('Kỹ năng sống');
    expect(within(primaryResults).getByText('Ngủ ngon nhé')).toBeInTheDocument();
    expect(within(primaryResults).getByText('Sóc không hề tham lam')).toBeInTheDocument();
    expect(within(primaryResults).queryByText('Sách thứ nhất')).not.toBeInTheDocument();
  });

  it('deduplicates normalized equivalent suggestion values', async () => {
    const user = userEvent.setup();
    const suggestionBooks: PdfBookState[] = [
      {
        ...mockBooks[0],
        config: { ...mockBooks[0].config, id: 'accented', title: 'Kỹ năng', subject: 'Chủ đề một', keywords: [] },
      },
      {
        ...mockBooks[1],
        config: { ...mockBooks[1].config, id: 'plain', title: 'KY NANG', subject: 'Chủ đề hai', keywords: [] },
      },
    ];
    render(<BookListPage books={suggestionBooks} onSelectBook={vi.fn()} />);

    await user.type(screen.getByRole('searchbox', { name: 'Tìm sách' }), 'ky nang');

    expect(screen.getAllByRole('button', { name: /Tìm theo gợi ý: (Kỹ năng|KY NANG)/ })).toHaveLength(1);
  });

  it('clears the query and restores every book', async () => {
    const user = userEvent.setup();
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);
    const searchbox = screen.getByRole('searchbox', { name: 'Tìm sách' });

    await user.type(searchbox, 'chia sẻ');
    await user.click(screen.getByRole('button', { name: 'Mở bộ lọc' }));
    const subjectSelect = screen.getByRole('combobox', { name: 'Chủ đề' });
    await user.selectOptions(subjectSelect, 'Kỹ năng sống');
    await user.click(screen.getByRole('button', { name: 'Xóa tìm kiếm và bộ lọc' }));
    const primaryResults = screen.getByRole('region', { name: 'Kết quả phù hợp' });

    expect(searchbox).toHaveValue('');
    expect(subjectSelect).toHaveValue('');
    expect(within(primaryResults).getByText('Sách thứ nhất')).toBeInTheDocument();
    expect(within(primaryResults).getByText('Ngủ ngon nhé')).toBeInTheDocument();
    expect(within(primaryResults).getByText('Sóc không hề tham lam')).toBeInTheDocument();
  });

  it('does not show suggestions before a query is entered', () => {
    render(<BookListPage books={mockBooks} onSelectBook={vi.fn()} />);

    expect(screen.queryByLabelText('Gợi ý tìm kiếm')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tìm theo gợi ý:/ })).not.toBeInTheDocument();
  });
});
