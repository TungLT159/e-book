import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  it('renders page status and calls control handlers', async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onResetZoom = vi.fn();
    const onFullscreen = vi.fn();

    render(
      <Toolbar
        currentPage={2}
        totalPages={6}
        zoom={1.1}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={onPrevious}
        onNext={onNext}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onResetZoom={onResetZoom}
        onFullscreen={onFullscreen}
      />,
    );

    expect(screen.getByText('Page 2 / 6')).toBeInTheDocument();
    expect(screen.getByText('110%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /previous page/i }));
    await user.click(screen.getByRole('button', { name: /next page/i }));
    await user.click(screen.getByRole('button', { name: /zoom in/i }));
    await user.click(screen.getByRole('button', { name: /zoom out/i }));
    await user.click(screen.getByRole('button', { name: /reset zoom/i }));
    await user.click(screen.getByRole('button', { name: /fullscreen/i }));

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onResetZoom).toHaveBeenCalledTimes(1);
    expect(onFullscreen).toHaveBeenCalledTimes(1);
  });

  it('disables unavailable navigation buttons', () => {
    render(
      <Toolbar
        currentPage={1}
        totalPages={6}
        zoom={1}
        canGoPrevious={false}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onResetZoom={vi.fn()}
        onFullscreen={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled();
  });
});
