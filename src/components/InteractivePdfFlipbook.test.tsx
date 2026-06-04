/// <reference types="node" />

import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractivePdfFlipbook, resolvePublicAssetPath } from './InteractivePdfFlipbook';

const flip = vi.fn();
const flipNext = vi.fn();
const flipPrev = vi.fn();
const play = vi.fn(() => Promise.resolve());
const receivedDocumentProps = vi.fn();
const receivedFlipBookProps = vi.fn();
const receivedPageProps = vi.fn();
const getDocument = vi.hoisted(() =>
  vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 3,
      getPage: async (pageNumber: number) => ({
        getTextContent: async () => ({
          items: [
            { str: `Trang ${pageNumber}` },
            { str: 'nội dung' },
          ],
        }),
      }),
    }),
  })),
);

type PageFlipRef = {
  pageFlip: () => {
    flip: (pageIndex: number) => void;
    flipNext: () => void;
    flipPrev: () => void;
  };
};

vi.mock('react-pageflip', () => ({
  default: React.forwardRef<PageFlipRef, { children: React.ReactNode; onFlip?: (event: { data: number }) => void }>(
    ({ children, onFlip, ...props }, ref) => {
      receivedFlipBookProps(props);
      React.useImperativeHandle(ref, () => ({
        pageFlip: () => ({
          flip: (pageIndex: number) => {
            flip(pageIndex);
            onFlip?.({ data: pageIndex });
          },
          flipNext: () => {
            flipNext();
            onFlip?.({ data: 1 });
          },
          flipPrev: () => {
            flipPrev();
            onFlip?.({ data: 0 });
          },
        }),
      }));

      return (
        <div data-testid="mock-pageflip">
          <button type="button" onClick={() => onFlip?.({ data: 1 })}>Mock user flip to page 2</button>
          <button type="button" onClick={() => onFlip?.({ data: 2 })}>Mock user flip</button>
          {children}
        </div>
      );
    },
  ),
}));

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  Document: ({
    children,
    className,
    error,
    file,
    loading,
    onLoadError,
    onLoadSuccess,
  }: {
    children: React.ReactNode;
    className?: string;
    error?: React.ReactNode;
    file?: string;
    loading?: React.ReactNode;
    onLoadError?: (error: Error) => void;
    onLoadSuccess?: (pdf: { numPages: number }) => void;
  }) => {
    receivedDocumentProps({ className, file, loading });

    React.useEffect(() => {
      if (file?.includes('missing')) {
        onLoadError?.(new Error('Missing PDF'));
        return;
      }
      onLoadSuccess?.({ numPages: 3 });
    }, [file, onLoadError, onLoadSuccess]);

    if (file?.includes('missing')) {
      return <div className={className} data-testid="mock-document">{error}</div>;
    }

    return <div className={className} data-testid="mock-document">{children}</div>;
  },
  Page: ({ pageNumber, ...props }: { pageNumber: number }) => {
    receivedPageProps({ pageNumber, ...props });
    return <div>PDF page {pageNumber}</div>;
  },
}));

vi.mock('pdfjs-dist', () => ({
  getDocument,
  GlobalWorkerOptions: { workerSrc: '' },
}));

const timeline = [
  { page: 1, start: 0, end: 8 },
  { page: 2, start: 8, end: 16 },
  { page: 3, start: 16, end: 24 },
];

const originalRequestFullscreenDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'requestFullscreen',
);
const originalExitFullscreenDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'exitFullscreen',
);
const originalFullscreenElementDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'fullscreenElement',
);

describe('InteractivePdfFlipbook', () => {
  beforeEach(() => {
    vi.useRealTimers();
    flip.mockClear();
    flipNext.mockClear();
    flipPrev.mockClear();
    play.mockClear();
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: play,
    });
    receivedDocumentProps.mockClear();
    receivedFlipBookProps.mockClear();
    receivedPageProps.mockClear();
  });

  afterEach(() => {
    if (originalRequestFullscreenDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'requestFullscreen',
        originalRequestFullscreenDescriptor,
      );
    } else {
      delete (HTMLElement.prototype as { requestFullscreen?: HTMLElement['requestFullscreen'] }).requestFullscreen;
    }

    if (originalExitFullscreenDescriptor) {
      Object.defineProperty(document, 'exitFullscreen', originalExitFullscreenDescriptor);
    } else {
      delete (document as { exitFullscreen?: Document['exitFullscreen'] }).exitFullscreen;
    }

    if (originalFullscreenElementDescriptor) {
      Object.defineProperty(document, 'fullscreenElement', originalFullscreenElementDescriptor);
    } else {
      delete (document as { fullscreenElement?: Document['fullscreenElement'] }).fullscreenElement;
    }
  });

  it('renders PDF pages inside the flipbook and wires the audio source', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    expect(screen.getByText('PDF page 2')).toBeInTheDocument();
    expect(screen.getByText('PDF page 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Hiệu ứng âm thanh lật trang')).toHaveAttribute(
      'src',
      '/Audio/effects/page-flip.mp3',
    );
    expect(receivedDocumentProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        className: 'interactive-reader__document',
      }),
    );
    const documentProps = receivedDocumentProps.mock.calls.at(-1)?.[0];
    expect(React.isValidElement(documentProps.loading)).toBe(true);
    expect((documentProps.loading as React.ReactElement<{ children: React.ReactNode }>).props.children).toBe(
      'Đang tải PDF...',
    );
    expect(receivedFlipBookProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startPage: 0,
        width: 660,
        height: 720,
        maxWidth: 660,
        maxHeight: 720,
        flippingTime: 650,
        autoSize: false,
        renderOnlyPageLengthChange: true,
        showCover: true,
        showPageCorners: false,
        style: { width: '100%', height: '100%' },
        usePortrait: false,
        mobileScrollSupport: true,
      }),
    );
    expect(receivedPageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNumber: 1,
        width: 660,
        className: 'interactive-reader__pdf-page',
      }),
    );
    expect(screen.getByLabelText('Bìa trước: trang 1')).toHaveClass('interactive-reader__page--front-cover');
    expect(screen.getByLabelText('Bìa sau: trang 3')).toHaveClass('interactive-reader__page--back-cover');
    expect(screen.getByLabelText('Trang 2')).toHaveClass('interactive-reader__page');
  });

  it('shows a direct library back button in the reader header', async () => {
    const onBackToLibrary = vi.fn();

    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
        onBackToLibrary={onBackToLibrary}
      />,
    );

    await screen.findByText('PDF page 1');

    fireEvent.click(screen.getByRole('button', { name: 'Về thư viện' }));

    expect(onBackToLibrary).toHaveBeenCalledTimes(1);
  });

  it('waits until the flip animation settles before updating the visible page status', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');

    vi.useFakeTimers();

    fireEvent.click(screen.getByText('Mock user flip'));

    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Trang 1 / 3')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(650);
    });

    expect(screen.getByText('Trang 3 / 3')).toBeInTheDocument();
  });

  it('offers side navigation and first/last page jumps', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');

    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('button', { name: /trang tiếp theo/i }));
    expect(flipNext).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Trang 1 / 3')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(650);
    });

    expect(screen.getByText('Trang 2 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Mock user flip'));
    act(() => {
      vi.advanceTimersByTime(650);
    });

    fireEvent.click(screen.getByRole('button', { name: /trang trước/i }));
    expect(flipPrev).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /trang đầu/i }));
    expect(flip).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /trang cuối/i }));
    expect(flip).toHaveBeenCalledWith(2);
  });

  it('disables first and last page jumps when already at the boundary page', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    expect(screen.getByRole('button', { name: /trang đầu/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /trang cuối/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /đóng menu điều khiển/i }));

    vi.useFakeTimers();
    fireEvent.click(screen.getByText('Mock user flip'));
    act(() => {
      vi.advanceTimersByTime(650);
    });

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    expect(screen.getByRole('button', { name: /trang đầu/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /trang cuối/i })).toBeDisabled();
  });

  it('zooms the flipbook within limits from the reader menu', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');

    const reader = screen.getByLabelText('Trình đọc tương tác cho Demo book');

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /phóng to/i }));
    expect(reader).toHaveStyle({ '--interactive-reader-zoom': '1.1' });

    fireEvent.click(screen.getByRole('button', { name: /^thu nhỏ$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^thu nhỏ$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^thu nhỏ$/i }));
    expect(reader).toHaveStyle({ '--interactive-reader-zoom': '0.8' });
  });

  it('toggles fullscreen for the reader', async () => {
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const exitFullscreen = vi.fn(() => Promise.resolve());

    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    });

    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /toàn màn hình/i }));

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('keeps fullscreen controls unchanged when fullscreen request fails', async () => {
    const requestFullscreen = vi.fn(() => Promise.reject(new Error('Denied')));

    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    });

    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /toàn màn hình/i }));
    await act(async () => undefined);

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /toàn màn hình/i })).toBeInTheDocument();
  });

  it('auto flips until the final page and can be toggled off', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');

    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /tự lật trang/i }));

    act(() => {
      vi.advanceTimersByTime(3200);
    });

    expect(flipNext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Mock user flip'));
    act(() => {
      vi.advanceTimersByTime(650);
    });

    act(() => {
      vi.advanceTimersByTime(3200);
    });

    expect(flipNext).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /tự lật trang/i })).toBeInTheDocument();
  });

  it('opens thumbnail navigation from the reader menu and jumps to the selected page', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /hình thu nhỏ/i }));

    const thumbnailPanel = screen.getByLabelText('Bảng hình thu nhỏ PDF');
    expect(thumbnailPanel).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hình thu nhỏ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đóng hình thu nhỏ' })).toHaveAttribute(
      'title',
      'Đóng hình thu nhỏ',
    );
    expect(within(thumbnailPanel).getAllByText(/Trang \d+/)).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /đến trang 3/i }));

    expect(flip).toHaveBeenCalledWith(2);
    expect(screen.queryByLabelText('Bảng hình thu nhỏ PDF')).not.toBeInTheDocument();
  });

  it('closes open reader overlays with Escape', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    expect(screen.getByLabelText('Menu điều khiển trình đọc')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByLabelText('Menu điều khiển trình đọc')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /hình thu nhỏ/i }));
    expect(screen.getByLabelText('Bảng hình thu nhỏ PDF')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByLabelText('Bảng hình thu nhỏ PDF')).not.toBeInTheDocument();
  });

  it('plays one page flip sound for programmatic page navigation', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');

    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('button', { name: /trang tiếp theo/i }));

    expect(play).toHaveBeenCalledTimes(1);
  });

  it('keeps the latest visible page when flips happen rapidly', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');

    vi.useFakeTimers();

    fireEvent.click(screen.getByText('Mock user flip'));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.click(screen.getByText('Mock user flip to page 2'));
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText('Trang 1 / 3')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText('Trang 2 / 3')).toBeInTheDocument();
  });

  it('does not render narration audio controls anymore', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');
    expect(screen.queryByLabelText('Âm thanh kể chuyện cho Demo book')).toBeNull();
  });

  it('resolves public asset paths against the Vite base URL', () => {
    expect(resolvePublicAssetPath('/books/demo.pdf', '/reader/')).toBe('/reader/books/demo.pdf');
    expect(resolvePublicAssetPath('books/demo.pdf', '/reader/')).toBe('/reader/books/demo.pdf');
    expect(resolvePublicAssetPath('https://cdn.example.com/book.pdf', '/reader/')).toBe('https://cdn.example.com/book.pdf');
  });

  it('shows the real PDF load error and resolved path', async () => {
    render(
      <InteractivePdfFlipbook
        title="Broken book"
        pdfPath="/books/missing.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    expect(await screen.findByText(/Không thể tải PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/Đường dẫn:/i)).toBeInTheDocument();
    expect(screen.getByText(/\/books\/missing\.pdf/i)).toBeInTheDocument();
  });

  it('renders the PDF document directly without the old clipping book-stage wrapper', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');

    expect(document.querySelector('.interactive-reader__book-stage')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-document')).toHaveClass('interactive-reader__document');
  });

  it('keeps PDF pages mounted while the current page changes', async () => {
    render(
      <InteractivePdfFlipbook
        title="Demo book"
        pdfPath="/books/demo.pdf"
        audioPath="/books/demo.mp3"
        timeline={timeline}
      />,
    );

    await screen.findByText('PDF page 1');
    expect(receivedPageProps).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole('button', { name: 'Trang tiếp theo' }));

    await waitFor(() => expect(screen.getByText('Trang 2 / 3')).toBeInTheDocument());
    expect(receivedPageProps).toHaveBeenCalledTimes(3);
  });

  it('does not paint-contain the flipbook document during cover flips', () => {
    const appCss = readFileSync(join(process.cwd(), 'src/App.css'), 'utf8');
    const documentRule = appCss.match(/\.interactive-reader__document\s*\{[^}]*\}/)?.[0];

    expect(documentRule).toBeDefined();
    expect(documentRule).toMatch(/overflow:\s*visible/);
    expect(documentRule).not.toMatch(/contain:\s*[^;]*paint/);
  });
});
