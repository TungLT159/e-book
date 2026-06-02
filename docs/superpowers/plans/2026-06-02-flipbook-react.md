# Flipbook React Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new Vite React app in `E:\gitlab\e-book` with a FlipHTML5-like local flipbook viewer that supports page flipping, thumbnails, navigation, zoom, fullscreen, and easy page replacement later.

**Architecture:** Use a small React single-page app with focused components. Static book page metadata lives in one config file, placeholder SVG pages live under `public/pages`, and `react-pageflip` handles the physical page-turn interaction.

**Tech Stack:** React, Vite, TypeScript, `react-pageflip`, CSS, Vitest, Testing Library.

---

## File Structure

- Create `package.json`: npm scripts and dependencies.
- Create `index.html`: Vite HTML entry.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`: TypeScript and Vite configuration with Vitest enabled.
- Create `src/main.tsx`: React app bootstrap.
- Create `src/App.tsx`: app shell and top-level layout.
- Create `src/App.css`: responsive visual styling.
- Create `src/components/FlipbookViewer.tsx`: pageflip integration, current page state, zoom state, fullscreen behavior.
- Create `src/components/Toolbar.tsx`: presentational control bar.
- Create `src/components/ThumbnailStrip.tsx`: presentational thumbnail navigation.
- Create `src/data/bookPages.ts`: replaceable page metadata.
- Create `src/test/setup.ts`: Testing Library setup.
- Create `src/components/Toolbar.test.tsx`: toolbar behavior tests.
- Create `src/components/ThumbnailStrip.test.tsx`: thumbnail behavior tests.
- Create `src/components/FlipbookViewer.test.tsx`: state/control integration tests with a mocked pageflip component.
- Create `public/pages/page-1.svg` through `public/pages/page-6.svg`: placeholder page assets.

## Task 1: Scaffold Vite React Project

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Create project configuration files**

Create `package.json`:

```json
{
  "name": "flipbook-react",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest",
    "react-pageflip": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "jsdom": "latest",
    "vitest": "latest"
  }
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Flipbook React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
});
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: dependency installation completes and creates `package-lock.json`.

- [ ] **Step 3: Run initial build to confirm scaffold is incomplete as expected**

Run: `npm run build`

Expected: FAIL because `src/main.tsx` does not exist yet. This verifies the scripts are wired and the next task supplies the app entry.

## Task 2: Add Book Page Data And Placeholder Assets

**Files:**
- Create: `src/data/bookPages.ts`
- Create: `public/pages/page-1.svg`
- Create: `public/pages/page-2.svg`
- Create: `public/pages/page-3.svg`
- Create: `public/pages/page-4.svg`
- Create: `public/pages/page-5.svg`
- Create: `public/pages/page-6.svg`

- [ ] **Step 1: Create page metadata**

Create `src/data/bookPages.ts`:

```ts
export type BookPage = {
  id: number;
  title: string;
  image: string;
  thumbnail: string;
};

export const bookPages: BookPage[] = [
  { id: 1, title: 'Cover', image: '/pages/page-1.svg', thumbnail: '/pages/page-1.svg' },
  { id: 2, title: 'Activity 1', image: '/pages/page-2.svg', thumbnail: '/pages/page-2.svg' },
  { id: 3, title: 'Activity 2', image: '/pages/page-3.svg', thumbnail: '/pages/page-3.svg' },
  { id: 4, title: 'Activity 3', image: '/pages/page-4.svg', thumbnail: '/pages/page-4.svg' },
  { id: 5, title: 'Activity 4', image: '/pages/page-5.svg', thumbnail: '/pages/page-5.svg' },
  { id: 6, title: 'Back Cover', image: '/pages/page-6.svg', thumbnail: '/pages/page-6.svg' },
];
```

- [ ] **Step 2: Create placeholder SVG pages**

Create six SVG files. Use this exact structure, changing the title and accent color per file.

Create `public/pages/page-1.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100" role="img" aria-label="Cover">
  <rect width="800" height="1100" fill="#fff8e8"/>
  <rect x="54" y="54" width="692" height="992" rx="36" fill="#ffffff" stroke="#f4a261" stroke-width="10"/>
  <circle cx="400" cy="300" r="120" fill="#f4a261" opacity="0.22"/>
  <text x="400" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#263238">Flipbook Demo</text>
  <text x="400" y="335" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#5f6c72">Cover Page</text>
  <path d="M220 700 C300 610 500 610 580 700" fill="none" stroke="#2a9d8f" stroke-width="18" stroke-linecap="round"/>
  <text x="400" y="900" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#5f6c72">Replace these SVG files with PDF page images later.</text>
</svg>
```

Create `public/pages/page-2.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100" role="img" aria-label="Activity 1">
  <rect width="800" height="1100" fill="#eef7ff"/>
  <rect x="54" y="54" width="692" height="992" rx="36" fill="#ffffff" stroke="#457b9d" stroke-width="10"/>
  <text x="400" y="180" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#1d3557">Activity 1</text>
  <text x="400" y="240" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#52616b">Trace the route</text>
  <path d="M170 760 C230 520 340 650 395 450 S570 280 630 640" fill="none" stroke="#457b9d" stroke-width="12" stroke-dasharray="18 20" stroke-linecap="round"/>
  <circle cx="170" cy="760" r="38" fill="#e63946"/>
  <circle cx="630" cy="640" r="38" fill="#2a9d8f"/>
</svg>
```

Create `public/pages/page-3.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100" role="img" aria-label="Activity 2">
  <rect width="800" height="1100" fill="#f6f1ff"/>
  <rect x="54" y="54" width="692" height="992" rx="36" fill="#ffffff" stroke="#8e7dbe" stroke-width="10"/>
  <text x="400" y="180" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#3d315b">Activity 2</text>
  <text x="400" y="240" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#5f5871">Find the shapes</text>
  <rect x="180" y="380" width="150" height="150" rx="22" fill="none" stroke="#8e7dbe" stroke-width="14"/>
  <circle cx="530" cy="455" r="82" fill="none" stroke="#f4a261" stroke-width="14"/>
  <polygon points="400,650 300,850 500,850" fill="none" stroke="#2a9d8f" stroke-width="14" stroke-linejoin="round"/>
</svg>
```

Create `public/pages/page-4.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100" role="img" aria-label="Activity 3">
  <rect width="800" height="1100" fill="#fff2f2"/>
  <rect x="54" y="54" width="692" height="992" rx="36" fill="#ffffff" stroke="#e76f51" stroke-width="10"/>
  <text x="400" y="180" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#7f2f1f">Activity 3</text>
  <text x="400" y="240" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#69514b">Color the picture</text>
  <circle cx="400" cy="550" r="150" fill="none" stroke="#e76f51" stroke-width="16"/>
  <path d="M290 540 Q400 430 510 540 Q400 700 290 540Z" fill="none" stroke="#264653" stroke-width="14" stroke-linejoin="round"/>
  <line x1="400" y1="400" x2="400" y2="700" stroke="#2a9d8f" stroke-width="10"/>
</svg>
```

Create `public/pages/page-5.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100" role="img" aria-label="Activity 4">
  <rect width="800" height="1100" fill="#effaf4"/>
  <rect x="54" y="54" width="692" height="992" rx="36" fill="#ffffff" stroke="#2a9d8f" stroke-width="10"/>
  <text x="400" y="180" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#174d44">Activity 4</text>
  <text x="400" y="240" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#52616b">Count the stars</text>
  <g fill="none" stroke="#2a9d8f" stroke-width="12" stroke-linejoin="round">
    <polygon points="250,410 275,480 350,480 290,525 315,600 250,555 185,600 210,525 150,480 225,480"/>
    <polygon points="550,390 575,460 650,460 590,505 615,580 550,535 485,580 510,505 450,460 525,460"/>
    <polygon points="400,650 425,720 500,720 440,765 465,840 400,795 335,840 360,765 300,720 375,720"/>
  </g>
</svg>
```

Create `public/pages/page-6.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100" role="img" aria-label="Back Cover">
  <rect width="800" height="1100" fill="#f3f4f6"/>
  <rect x="54" y="54" width="692" height="992" rx="36" fill="#ffffff" stroke="#6b7280" stroke-width="10"/>
  <text x="400" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="#263238">The End</text>
  <text x="400" y="380" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#5f6c72">Back Cover</text>
  <text x="400" y="760" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#5f6c72">Add more pages in src/data/bookPages.ts</text>
</svg>
```

- [ ] **Step 3: Run TypeScript check through build**

Run: `npm run build`

Expected: FAIL because `src/main.tsx` still does not exist. No errors should reference `src/data/bookPages.ts`.

## Task 3: Add Toolbar And Thumbnail Components With Tests

**Files:**
- Create: `src/components/Toolbar.tsx`
- Create: `src/components/ThumbnailStrip.tsx`
- Create: `src/components/Toolbar.test.tsx`
- Create: `src/components/ThumbnailStrip.test.tsx`

- [ ] **Step 1: Write Toolbar test**

Create `src/components/Toolbar.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Write ThumbnailStrip test**

Create `src/components/ThumbnailStrip.test.tsx`:

```tsx
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
```

- [ ] **Step 3: Run component tests to verify they fail**

Run: `npm test -- src/components/Toolbar.test.tsx src/components/ThumbnailStrip.test.tsx`

Expected: FAIL because `Toolbar.tsx` and `ThumbnailStrip.tsx` do not exist yet.

- [ ] **Step 4: Implement Toolbar**

Create `src/components/Toolbar.tsx`:

```tsx
type ToolbarProps = {
  currentPage: number;
  totalPages: number;
  zoom: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFullscreen: () => void;
};

export function Toolbar({
  currentPage,
  totalPages,
  zoom,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFullscreen,
}: ToolbarProps) {
  return (
    <div className="toolbar" aria-label="Flipbook controls">
      <button type="button" onClick={onPrevious} disabled={!canGoPrevious} aria-label="Previous page">
        Previous
      </button>
      <span className="toolbar__status">Page {currentPage} / {totalPages}</span>
      <button type="button" onClick={onNext} disabled={!canGoNext} aria-label="Next page">
        Next
      </button>
      <span className="toolbar__divider" aria-hidden="true" />
      <button type="button" onClick={onZoomOut} aria-label="Zoom out">-</button>
      <button type="button" onClick={onResetZoom} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
      <button type="button" onClick={onZoomIn} aria-label="Zoom in">+</button>
      <span className="toolbar__divider" aria-hidden="true" />
      <button type="button" onClick={onFullscreen} aria-label="Fullscreen">Fullscreen</button>
    </div>
  );
}
```

- [ ] **Step 5: Implement ThumbnailStrip**

Create `src/components/ThumbnailStrip.tsx`:

```tsx
import type { BookPage } from '../data/bookPages';

type ThumbnailStripProps = {
  pages: BookPage[];
  currentPageIndex: number;
  onSelectPage: (pageIndex: number) => void;
};

export function ThumbnailStrip({ pages, currentPageIndex, onSelectPage }: ThumbnailStripProps) {
  return (
    <aside className="thumbnail-strip" aria-label="Page thumbnails">
      {pages.map((page, index) => (
        <button
          type="button"
          className="thumbnail-strip__item"
          key={page.id}
          onClick={() => onSelectPage(index)}
          aria-label={`Go to ${page.title}`}
          aria-current={index === currentPageIndex ? 'page' : undefined}
        >
          <img src={page.thumbnail} alt="" loading="lazy" />
          <span>{page.id}</span>
        </button>
      ))}
    </aside>
  );
}
```

- [ ] **Step 6: Run component tests to verify they pass**

Run: `npm test -- src/components/Toolbar.test.tsx src/components/ThumbnailStrip.test.tsx`

Expected: PASS.

## Task 4: Implement Flipbook Viewer With Tests

**Files:**
- Create: `src/components/FlipbookViewer.tsx`
- Create: `src/components/FlipbookViewer.test.tsx`

- [ ] **Step 1: Write FlipbookViewer test with mocked pageflip**

Create `src/components/FlipbookViewer.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bookPages } from '../data/bookPages';
import { FlipbookViewer } from './FlipbookViewer';

const flipNext = vi.fn();
const flipPrev = vi.fn();
const flip = vi.fn();

vi.mock('react-pageflip', () => ({
  default: React.forwardRef<HTMLDivElement, { children: React.ReactNode; onFlip?: (event: { data: number }) => void }>(
    ({ children, onFlip }, ref) => {
      React.useImperativeHandle(ref, () => ({
        pageFlip: () => ({
          flipNext,
          flipPrev,
          flip,
        }),
      }) as unknown as HTMLDivElement);

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
  });

  it('renders pages and changes viewer state from controls', async () => {
    const user = userEvent.setup();
    render(<FlipbookViewer pages={bookPages} />);

    expect(screen.getByText('Page 1 / 6')).toBeInTheDocument();
    expect(screen.getByAltText('Cover')).toBeInTheDocument();

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
```

- [ ] **Step 2: Run FlipbookViewer test to verify it fails**

Run: `npm test -- src/components/FlipbookViewer.test.tsx`

Expected: FAIL because `FlipbookViewer.tsx` does not exist yet.

- [ ] **Step 3: Implement FlipbookViewer**

Create `src/components/FlipbookViewer.tsx`:

```tsx
import { useRef, useState } from 'react';
import HTMLFlipBook from 'react-pageflip';
import type { BookPage } from '../data/bookPages';
import { ThumbnailStrip } from './ThumbnailStrip';
import { Toolbar } from './Toolbar';

type PageFlipApi = {
  flipNext: () => void;
  flipPrev: () => void;
  flip: (pageIndex: number) => void;
};

type PageFlipRef = {
  pageFlip: () => PageFlipApi;
};

type FlipbookViewerProps = {
  pages: BookPage[];
};

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

export function FlipbookViewer({ pages }: FlipbookViewerProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const bookRef = useRef<PageFlipRef | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);

  const totalPages = pages.length;
  const currentPage = currentPageIndex + 1;

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));

  const goPrevious = () => {
    bookRef.current?.pageFlip().flipPrev();
  };

  const goNext = () => {
    bookRef.current?.pageFlip().flipNext();
  };

  const selectPage = (pageIndex: number) => {
    bookRef.current?.pageFlip().flip(pageIndex);
    setCurrentPageIndex(pageIndex);
  };

  const enterFullscreen = () => {
    void viewerRef.current?.requestFullscreen?.();
  };

  return (
    <section className="viewer" ref={viewerRef}>
      <Toolbar
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        canGoPrevious={currentPageIndex > 0}
        canGoNext={currentPageIndex < totalPages - 1}
        onPrevious={goPrevious}
        onNext={goNext}
        onZoomIn={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
        onZoomOut={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
        onResetZoom={() => setZoom(1)}
        onFullscreen={enterFullscreen}
      />
      <div className="viewer__workspace">
        <ThumbnailStrip pages={pages} currentPageIndex={currentPageIndex} onSelectPage={selectPage} />
        <div className="viewer__book-stage" style={{ '--book-zoom': zoom } as React.CSSProperties}>
          <HTMLFlipBook
            ref={bookRef as never}
            width={420}
            height={580}
            size="stretch"
            minWidth={280}
            maxWidth={520}
            minHeight={390}
            maxHeight={720}
            drawShadow={true}
            flippingTime={850}
            usePortrait={true}
            startZIndex={1}
            autoSize={true}
            maxShadowOpacity={0.24}
            showCover={true}
            mobileScrollSupport={true}
            className="viewer__book"
            style={{}}
            onFlip={(event: { data: number }) => setCurrentPageIndex(event.data)}
          >
            {pages.map((page) => (
              <article className="viewer__page" key={page.id}>
                <img src={page.image} alt={page.title} loading={page.id === 1 ? 'eager' : 'lazy'} />
                <span className="viewer__image-fallback">Could not load {page.title}</span>
              </article>
            ))}
          </HTMLFlipBook>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run FlipbookViewer test to verify it passes**

Run: `npm test -- src/components/FlipbookViewer.test.tsx`

Expected: PASS.

## Task 5: Add App Shell And Responsive Styling

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`

- [ ] **Step 1: Create React entry and app shell**

Create `src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `src/App.tsx`:

```tsx
import { FlipbookViewer } from './components/FlipbookViewer';
import { bookPages } from './data/bookPages';

export default function App() {
  return (
    <main className="app-shell">
      <header className="hero">
        <p className="hero__eyebrow">React Flipbook</p>
        <h1>Interactive ebook reader</h1>
        <p>
          Flip pages, zoom, jump from thumbnails, and switch to fullscreen. Replace the placeholder pages with images exported from your PDF later.
        </p>
      </header>
      <FlipbookViewer pages={bookPages} />
    </main>
  );
}
```

- [ ] **Step 2: Add responsive CSS**

Create `src/App.css`:

```css
:root {
  color: #172026;
  background: #f4efe6;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 32px;
  background:
    radial-gradient(circle at top left, rgba(244, 162, 97, 0.32), transparent 34rem),
    linear-gradient(135deg, #fff8ed 0%, #edf4f7 100%);
}

.hero {
  max-width: 960px;
  margin: 0 auto 24px;
  text-align: center;
}

.hero__eyebrow {
  margin: 0 0 8px;
  color: #b65f2b;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero h1 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 4.5rem);
  line-height: 1;
}

.hero p:last-child {
  max-width: 720px;
  margin: 16px auto 0;
  color: #52616b;
  font-size: 1.05rem;
}

.viewer {
  max-width: 1180px;
  margin: 0 auto;
  padding: 18px;
  border: 1px solid rgba(23, 32, 38, 0.1);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 24px 80px rgba(38, 50, 56, 0.18);
  backdrop-filter: blur(14px);
}

.viewer:fullscreen {
  max-width: none;
  width: 100vw;
  height: 100vh;
  border-radius: 0;
  overflow: auto;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 18px;
}

.toolbar button,
.thumbnail-strip__item {
  border: 0;
  border-radius: 999px;
  color: #172026;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(38, 50, 56, 0.12);
  cursor: pointer;
}

.toolbar button {
  min-height: 42px;
  padding: 0 16px;
  font-weight: 700;
}

.toolbar button:hover:not(:disabled),
.thumbnail-strip__item:hover {
  transform: translateY(-1px);
}

.toolbar button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.toolbar__status {
  min-width: 104px;
  color: #52616b;
  font-weight: 800;
  text-align: center;
}

.toolbar__divider {
  width: 1px;
  height: 28px;
  background: rgba(23, 32, 38, 0.12);
}

.viewer__workspace {
  display: grid;
  grid-template-columns: 116px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.thumbnail-strip {
  display: flex;
  max-height: 680px;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  padding: 4px 8px 4px 4px;
}

.thumbnail-strip__item {
  position: relative;
  display: block;
  padding: 6px;
  border-radius: 16px;
}

.thumbnail-strip__item[aria-current="page"] {
  outline: 3px solid #f4a261;
}

.thumbnail-strip__item img {
  display: block;
  width: 78px;
  aspect-ratio: 8 / 11;
  border-radius: 10px;
  object-fit: cover;
}

.thumbnail-strip__item span {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 999px;
  background: rgba(23, 32, 38, 0.78);
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 800;
}

.viewer__book-stage {
  display: flex;
  min-height: 650px;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 28px;
}

.viewer__book {
  transform: scale(var(--book-zoom));
  transform-origin: center center;
  transition: transform 180ms ease;
}

.viewer__page {
  position: relative;
  display: grid;
  height: 100%;
  place-items: center;
  overflow: hidden;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(23, 32, 38, 0.08);
}

.viewer__page img {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.viewer__image-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  color: #52616b;
  text-align: center;
}

@media (max-width: 760px) {
  .app-shell {
    padding: 18px;
  }

  .viewer {
    padding: 12px;
    border-radius: 20px;
  }

  .viewer__workspace {
    grid-template-columns: 1fr;
  }

  .thumbnail-strip {
    order: 2;
    max-height: none;
    flex-direction: row;
    padding: 8px 4px;
  }

  .viewer__book-stage {
    min-height: 460px;
    padding: 16px;
  }

  .toolbar__divider {
    display: none;
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: PASS and `dist` is generated.

## Task 6: Final Verification And Usage Notes

**Files:**
- Create: `README.md`

- [ ] **Step 1: Add README**

Create `README.md`:

````md
# Flipbook React

React/Vite ebook reader with page flipping, thumbnails, zoom controls, and fullscreen mode.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Replace Pages Later

Export your PDF pages to image files and put them in `public/pages`. Update `src/data/bookPages.ts` so each page points to the correct image and thumbnail path.

Each page entry uses this shape:

```ts
{
  id: 1,
  title: 'Cover',
  image: '/pages/page-1.png',
  thumbnail: '/pages/page-1.png'
}
```
````

- [ ] **Step 2: Run full verification**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Start dev server for manual review**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a local URL such as `http://127.0.0.1:5173/`. Open it and verify previous/next, thumbnail selection, zoom, and fullscreen are visible and usable.

## Self-Review

- Spec coverage: The plan covers new React project setup, local replaceable pages, page flipping, previous/next controls, thumbnail navigation, zoom controls, fullscreen, responsive CSS, fallback image text, and build/test verification.
- Placeholder scan: No incomplete markers remain. Placeholder page assets are intentional runtime demo content, not incomplete plan content.
- Type consistency: `BookPage`, component props, and test references use the same names across tasks.
