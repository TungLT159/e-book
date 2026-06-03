# Book List Page — Design Spec

## Overview

Add a full-page book list / library view as the landing/home page of the eBook reader app. Currently the app opens directly into the reader with a thin horizontal BookSelector bar. This spec replaces that with a rich grid-based book selection page.

## Architecture

### View switching in App.tsx

Add a `view` state: `'home' | 'reader'`. No routing library — simple React state.

```
App.tsx
  view === 'home'   → <BookListPage books={pdfBooks} onSelectBook={handleSelect} />
  view === 'reader' → <InteractivePdfFlipbook ... />  (same as today)
```

- `handleSelect(bookId)` sets `view = 'reader'` and `activeBookId = bookId`
- The InteractivePdfFlipbook gets a new optional prop `onBackToLibrary` which switches `view` back to `'home'`

### Data model change

Add an optional `coverColors` field to `PdfBookConfig` so each book gets a distinct gradient cover:

```typescript
export type PdfBookConfig = {
  id: string;
  title: string;
  pdfPath: string;
  audioPath: string;
  timeline: AudioTimelineItem[];
  coverColors?: [string, string];  // NEW — two hex colours for gradient
};
```

Fallback: if `coverColors` is not set, derive colours deterministically from `id`.

### Component changes

| File | Change |
|---|---|
| `src/App.tsx` | Add `view` state; conditionally render BookListPage vs InteractivePdfFlipbook |
| `src/components/BookListPage.tsx` | **New** — grid of book cards |
| `src/components/InteractivePdfFlipbook.tsx` | Add `onBackToLibrary` prop; add "Về thư viện" menu item |
| `src/data/pdfBooks.ts` | Add `coverColors` to book configs |
| `src/App.css` | Add BookListPage styles |

## Component Design: BookListPage

### Props

```typescript
type BookListPageProps = {
  books: PdfBookConfig[];
  onSelectBook: (bookId: string) => void;
};
```

### Layout

```
┌──────────────────────────────────────────────────┐
│  📚  Thư viện sách                               │
│       Chọn một cuốn sách để đọc                   │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───  │
│  │  (grad)  │  │  (grad)  │  │  (grad)  │  │     │
│  │    S     │  │    N     │  │    T     │  │     │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├───  │
│  │Sóc...    │  │Ngủ...    │  │Truyện... │  │     │
│  │🎵 8 trang│  │🎵 3 trang│  │📄 5 trang│  │     │
│  └──────────┘  └──────────┘  └──────────┘  └───  │
└──────────────────────────────────────────────────┘
```

- **Header**: Title + subtitle
- **Grid**: CSS Grid with `auto-fill, minmax(220px, 1fr)`, gap 24px
- **Each card**: Entire card is a `<button>`. Two sections:
  - **Cover area** (~55% height): gradient fill + large initial letter
  - **Info area**: title, metadata row (audio/book icon + page count)

### Book card states

- **Default**: white bg, subtle shadow, rounded corners
- **Hover**: lift (translateY -4px), deeper shadow
- **Focus-visible**: ring outline for accessibility
- **Active**: scale down slightly for press feedback

### Empty state

If `books` array is empty, show a centered message "Chưa có sách nào." with a book icon.

## Styling

All CSS added to `src/App.css` following BEM convention:

```
.book-list-page           — full-page container
.book-list-page__header   — header block (title + subtitle)
.book-list-page__grid     — responsive CSS grid
.book-list-page__empty    — empty state

.book-card                — individual book card button
.book-card__cover         — gradient cover area
.book-card__initial       — large letter on cover
.book-card__info          — text info area
.book-card__title         — book title
.book-card__meta          — metadata row (icon + page count)
```

### Color palette (matching existing)

- Background: `#f4efe6` (inherited from `.app-shell`)
- Cards: white background, `rgba(23, 32, 38, 0.1)` borders
- Shadows: `0 4px 12px rgba(38, 50, 56, 0.08)` → hover `0 12px 32px rgba(38, 50, 56, 0.16)`
- Accent: `#f4a261` for hover borders
- Text: `#172026` title, `#52616b` metadata

### Responsive

- Default: grid columns auto-fill
- `max-width: 600px`: reduce padding, smaller cards (minmax 160px)
- Standard `prefers-reduced-motion` guard

## Reader "Về thư viện" button

The existing `InteractivePdfFlipbook` has a hamburger menu (top-right) with zoom/fullscreen toggles. Add a new item to this menu:

- Icon: `Library` (lucide-react) or text "📚"
- Label: "Thư viện"
- Action: calls `onBackToLibrary()` → App switches to `view = 'home'`

The `InteractivePdfFlipbook` already has a `headerRight` slot conceptually; the menu button is hardcoded inside the component. We'll add `onBackToLibrary?: () => void` and conditionally render the menu item.

## Out of Scope

- No cover image extraction from PDF (uses gradient initials instead)
- No search/filter functionality
- No book progress tracking
- No "recently read" section
- No routing library
