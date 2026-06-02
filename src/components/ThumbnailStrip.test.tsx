import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { bookPages } from '../data/bookPages';
import { ThumbnailStrip } from './ThumbnailStrip';

describe('ThumbnailStrip', () => {
  it('renders thumbnails and selects a page', async () => {
    const user = userEvent.setup();
    const onSelectPage = vi.fn();

    render(<ThumbnailStrip pages={bookPages} currentPageIndex={1} onSelectPage={onSelectPage} />);

    expect(screen.getByRole('button', { name: /go to cover/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to activity 1/i })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: /go to activity 2/i }));

    expect(onSelectPage).toHaveBeenCalledWith(2);
  });
});
