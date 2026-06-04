import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PdfBookState } from '../hooks/usePdfBookLoader';
import { BookSelector } from './BookSelector';

const books: PdfBookState[] = [
  {
    config: {
      id: 'b1',
      title: 'Book A',
      pdfPath: '/a.pdf',
      thumbnail: '/a.png',
      pageCount: 1,
      ageRange: '12+',
      subject: 'Test',
      keywords: [],
      favorite: false,
    },
    pages: [{ id: 1, title: 'Page 1', image: 'blob:1', thumbnail: 'blob:1' }],
    loaded: true,
  },
  {
    config: {
      id: 'b2',
      title: 'Book B',
      pdfPath: '/b.pdf',
      thumbnail: '/b.png',
      pageCount: 1,
      ageRange: '12+',
      subject: 'Test',
      keywords: [],
      favorite: false,
    },
    pages: [],
    loaded: false,
    error: 'Failed to load',
  },
  {
    config: {
      id: 'b3',
      title: 'Book C',
      pdfPath: '/c.pdf',
      thumbnail: '/c.png',
      pageCount: 1,
      ageRange: '12+',
      subject: 'Test',
      keywords: [],
      favorite: false,
    },
    pages: [],
    loaded: false,
  },
];

describe('BookSelector', () => {
  it('renders all books and highlights active', () => {
    render(<BookSelector books={books} activeBookId="b1" onSelectBook={vi.fn()} />);

    expect(screen.getByRole('button', { name: /book a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /book b/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /book c/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /book a/i })).toHaveAttribute('aria-current', 'page');
  });

  it('calls onSelectBook on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BookSelector books={books} activeBookId="b1" onSelectBook={onSelect} />);

    await user.click(screen.getByRole('button', { name: /book a/i }));
    expect(onSelect).toHaveBeenCalledWith('b1');
  });

  it('disables loading books without error', () => {
    render(<BookSelector books={books} activeBookId="b1" onSelectBook={vi.fn()} />);

    expect(screen.getByRole('button', { name: /book c/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /book b/i })).not.toBeDisabled();
  });

  it('shows loading spinner for in-progress books', () => {
    render(<BookSelector books={books} activeBookId="b1" onSelectBook={vi.fn()} />);

    expect(screen.getByRole('button', { name: /book c/i }).querySelector('.book-selector__spinner')).toBeTruthy();
    expect(screen.getByRole('button', { name: /book a/i }).querySelector('.book-selector__spinner')).toBeFalsy();
  });

  it('shows page count for loaded books', () => {
    render(<BookSelector books={books} activeBookId="b1" onSelectBook={vi.fn()} />);
    expect(screen.getByText('1 p.')).toBeInTheDocument();
  });

  it('shows error badge for failed books', () => {
    render(<BookSelector books={books} activeBookId="b1" onSelectBook={vi.fn()} />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('returns null for empty book list', () => {
    const { container } = render(
      <BookSelector books={[]} activeBookId="" onSelectBook={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
