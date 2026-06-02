import React from 'react';
import type HTMLFlipBook from 'react-pageflip';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bookPages } from '../data/bookPages';
import { FlipbookViewer } from './FlipbookViewer';

const flipNext = vi.fn();
const flipPrev = vi.fn();
const flip = vi.fn();
const receivedFlipBookProps = vi.fn();

type HTMLFlipBookProps = React.ComponentPropsWithoutRef<typeof HTMLFlipBook>;
type PageFlipRef = {
  pageFlip: () => {
    flipNext: () => void;
    flipPrev: () => void;
    flip: (pageIndex: number) => void;
  };
};

vi.mock('react-pageflip', () => ({
  default: React.forwardRef<PageFlipRef, HTMLFlipBookProps>(
    ({ children, onFlip, ...props }, ref) => {
      receivedFlipBookProps(props);
      React.useImperativeHandle(ref, () => ({
        pageFlip: () => ({
          flipNext,
          flipPrev,
          flip,
        }),
      }));

      return (
        <div data-testid="mock-pageflip">
          <button type="button" onClick={() => onFlip?.({ data: 2 })}>Mock flip to page 3</button>
          {children}
        </div>
      );
    },
  ),
}));

describe('FlipbookViewer', () => {
  beforeEach(() => {
    flipNext.mockClear();
    flipPrev.mockClear();
    flip.mockClear();
    receivedFlipBookProps.mockClear();
  });

  it('renders pages and changes viewer state from controls', async () => {
    const user = userEvent.setup();
    render(<FlipbookViewer pages={bookPages} />);

    expect(screen.getByText('Page 1 / 6')).toBeInTheDocument();
    expect(screen.getByAltText('Cover')).toBeInTheDocument();
    expect(receivedFlipBookProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startPage: 0,
        clickEventForward: true,
        useMouseEvents: true,
        swipeDistance: 30,
        showPageCorners: true,
        disableFlipByClick: false,
      }),
    );

    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(flipNext).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /go to activity 2/i }));
    expect(flip).toHaveBeenCalledWith(2);

    await user.click(screen.getByRole('button', { name: /mock flip to page 3/i }));
    expect(screen.getByText('Page 3 / 6')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(screen.getByText('110%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reset zoom/i }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
