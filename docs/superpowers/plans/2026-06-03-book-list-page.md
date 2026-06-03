# Book List Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the thin BookSelector bar with a full-page book list grid as the app's landing/home page.

**Architecture:** Add `view` state in App.tsx (`'home' | 'reader'`). Home renders new `BookListPage` component. Reader gets `onBackToLibrary` callback. No routing library added.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, CSS (BEM), lucide-react

---

### Task 1: Add optional `coverColors` to PdfBookConfig

**Files:**
- Modify: `src/data/pdfBooks.ts`

- [ ] **Step 1: Modify PdfBookConfig type and add colors to existing books**

```typescript
// In src/data/pdfBooks.ts

export type PdfBookConfig = {
  id: string;
  title: string;
  pdfPath: string;
  audioPath: string;
  timeline: AudioTimelineItem[];
  coverColors?: [string, string];
};

// Update existing active books with colors where assets are complete.
export const pdfBooks: PdfBookConfig[] = [
  {
    id: "soc-khong-he-tham-lam",
    title: "Sóc không hề tham lam",
    pdfPath: "/books/book.pdf",
    audioPath: "/books/sockhonghethamlam827b1_1312202316.mp3",
    timeline: [
      { page: 1, start: 0, end: 8 },
      { page: 2, start: 8, end: 16 },
      { page: 3, start: 16, end: 24 },
      { page: 4, start: 24, end: 32 },
      { page: 5, start: 32, end: 40 },
      { page: 6, start: 40, end: 48 },
      { page: 7, start: 48, end: 56 },
      { page: 8, start: 56, end: 64 },
    ],
    coverColors: ["#e8825c", "#c94b4b"],  // warm orange → red
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/data/pdfBooks.ts
git commit -m "feat: add coverColors to PdfBookConfig"
```

---

### Task 2: Create BookListPage component with tests

**Files:**
- Create: `src/components/BookListPage.tsx`
- Create: `src/components/BookListPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/BookListPage.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookListPage } from "./BookListPage";
import type { PdfBookConfig } from "../data/pdfBooks";
import { describe, it, expect, vi } from "vitest";

const mockBooks: PdfBookConfig[] = [
  {
    id: "book-1",
    title: "Sách thứ nhất",
    pdfPath: "/books/book1.pdf",
    audioPath: "/books/book1.mp3",
    timeline: [{ page: 1, start: 0, end: 10 }],
    coverColors: ["#e8825c", "#c94b4b"],
  },
  {
    id: "book-2",
    title: "Ngủ ngon nhé",
    pdfPath: "/books/book2.pdf",
    audioPath: "",
    timeline: [{ page: 1, start: 0, end: 5 }],
    coverColors: ["#667eea", "#764ba2"],
  },
];

describe("BookListPage", () => {
  it("renders the header and all book titles", () => {
    render(<BookListPage books={mockBooks} onSelectBook={() => {}} />);
    expect(screen.getByText("Thư viện sách")).toBeInTheDocument();
    expect(screen.getByText("Sách thứ nhất")).toBeInTheDocument();
    expect(screen.getByText("Ngủ ngon nhé")).toBeInTheDocument();
  });

  it("calls onSelectBook with book id when a card is clicked", async () => {
    const onSelect = vi.fn();
    render(<BookListPage books={mockBooks} onSelectBook={onSelect} />);
    const cards = screen.getAllByRole("button");
    await userEvent.click(cards[0]);
    expect(onSelect).toHaveBeenCalledWith("book-1");
  });

  it("shows page count for each book", () => {
    render(<BookListPage books={mockBooks} onSelectBook={() => {}} />);
    expect(screen.getAllByText("1 trang")).toHaveLength(2);
  });

  it("shows empty state when no books", () => {
    render(<BookListPage books={[]} onSelectBook={() => {}} />);
    expect(screen.getByText("Chưa có sách nào.")).toBeInTheDocument();
  });

  it("shows initial letter on card cover", () => {
    render(<BookListPage books={mockBooks} onSelectBook={() => {}} />);
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("N")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/BookListPage.test.tsx`
Expected: FAIL — module not found errors

- [ ] **Step 3: Implement BookListPage component**

```typescript
// src/components/BookListPage.tsx
import { Books } from "lucide-react";
import type { PdfBookConfig } from "../data/pdfBooks";

type BookListPageProps = {
  books: PdfBookConfig[];
  onSelectBook: (bookId: string) => void;
};

function getInitials(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

function getCoverColors(book: PdfBookConfig): [string, string] {
  if (book.coverColors) return book.coverColors;
  return ["#2a5d6b", "#f4a261"];
}

export function BookListPage({ books, onSelectBook }: BookListPageProps) {
  return (
    <div className="book-list-page">
      <header className="book-list-page__header">
        <h1 className="book-list-page__title">Thư viện sách</h1>
        <p className="book-list-page__subtitle">Chọn một cuốn sách để đọc</p>
      </header>

      {books.length === 0 ? (
        <div className="book-list-page__empty">
          <Books size={48} aria-hidden="true" />
          <p>Chưa có sách nào.</p>
        </div>
      ) : (
        <div className="book-list-page__grid">
          {books.map((book) => {
            const coverColors = getCoverColors(book);

            return (
            <button
              key={book.id}
              type="button"
              className="book-card"
              onClick={() => onSelectBook(book.id)}
              aria-label={`Đọc sách: ${book.title}`}
            >
              <div
                className="book-card__cover"
                style={{
                  background: `linear-gradient(135deg, ${coverColors[0]}, ${coverColors[1]})`,
                }}
              >
                <span className="book-card__initial">{getInitials(book.title)}</span>
              </div>
              <div className="book-card__info">
                <h3 className="book-card__title">{book.title}</h3>
                <p className="book-card__meta">
                  {book.timeline.length > 0 ? (
                    <>
                      <Books size={14} aria-hidden="true" />
                      {book.timeline.length} trang
                    </>
                  ) : (
                    "Không có trang"
                  )}
                </p>
              </div>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/BookListPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/BookListPage.tsx src/components/BookListPage.test.tsx
git commit -m "feat: add BookListPage component"
```

---

### Task 3: Add BookListPage CSS styles

**Files:**
- Modify: `src/App.css` (append before `@media` queries)

- [ ] **Step 1: Add styles at the end of the main rule block (before line 711, the first `@media`)**

```css
/* ── Book List Page ── */

.book-list-page {
  max-width: 1060px;
  margin: 0 auto;
  padding: 40px 20px 60px;
}

.book-list-page__header {
  margin-bottom: 36px;
  text-align: center;
}

.book-list-page__title {
  margin: 0 0 8px;
  font-size: clamp(1.6rem, 4vw, 2.6rem);
  font-weight: 800;
  color: #172026;
  letter-spacing: -0.03em;
}

.book-list-page__subtitle {
  margin: 0;
  color: #52616b;
  font-size: 1.05rem;
}

.book-list-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 20px;
  color: #52616b;
}

.book-list-page__empty p {
  margin: 0;
  font-size: 1.1rem;
}

.book-list-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;
}

.book-card {
  display: flex;
  flex-direction: column;
  padding: 0;
  border: 1px solid rgba(23, 32, 38, 0.1);
  border-radius: 20px;
  background: #ffffff;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(38, 50, 56, 0.08);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease;
  text-align: left;
  font: inherit;
  color: inherit;
}

.book-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(38, 50, 56, 0.16);
  border-color: rgba(244, 162, 97, 0.4);
}

.book-card:focus-visible {
  outline: 3px solid #f4a261;
  outline-offset: 2px;
}

.book-card:active {
  transform: translateY(-1px) scale(0.98);
}

.book-card__cover {
  display: grid;
  place-items: center;
  height: 180px;
  padding: 24px;
}

.book-card__initial {
  font-size: 3.5rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  line-height: 1;
  user-select: none;
}

.book-card__info {
  padding: 16px;
  text-align: center;
}

.book-card__title {
  margin: 0 0 8px;
  font-size: 1rem;
  font-weight: 700;
  color: #172026;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.book-card__meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0;
  color: #52616b;
  font-size: 0.85rem;
  font-weight: 600;
}

@media (max-width: 600px) {
  .book-list-page {
    padding: 24px 12px 40px;
  }

  .book-list-page__grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
  }

  .book-card__cover {
    height: 140px;
    padding: 16px;
  }

  .book-card__initial {
    font-size: 2.6rem;
  }

  .book-card__info {
    padding: 12px;
  }
}
```

- [ ] **Step 2: Add reduced-motion guard inside the existing `@media (prefers-reduced-motion: reduce)` block (after line 795)**

```css
  .book-card {
    animation: none;
    transition: none;
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "feat: add BookListPage styles"
```

---

### Task 4: Wire view switching in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update App.tsx with view state**

```typescript
import { useState } from "react";
import { InteractivePdfFlipbook } from "./components/InteractivePdfFlipbook";
import { BookListPage } from "./components/BookListPage";
import { pdfBooks } from "./data/pdfBooks";

type View = "home" | "reader";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [activeBookId, setActiveBookId] = useState(
    pdfBooks.length > 0 ? pdfBooks[0].id : "",
  );

  const handleSelectBook = (bookId: string) => {
    setActiveBookId(bookId);
    setView("reader");
  };

  const handleBackToLibrary = () => {
    setView("home");
  };

  const activeBook = pdfBooks.find((book) => book.id === activeBookId);

  if (view === "home") {
    return (
      <main className="app-shell">
        <BookListPage books={pdfBooks} onSelectBook={handleSelectBook} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      {activeBook ? (
        <InteractivePdfFlipbook
          title={activeBook.title}
          pdfPath={activeBook.pdfPath}
          audioPath={activeBook.audioPath}
          timeline={activeBook.timeline}
          onBackToLibrary={handleBackToLibrary}
        />
      ) : (
        <p className="loading-msg loading-msg--error">
          No static PDF book is configured.
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add home/reader view switching"
```

---

### Task 5: Add "Thư viện" button to InteractivePdfFlipbook

**Files:**
- Modify: `src/components/InteractivePdfFlipbook.tsx`

- [ ] **Step 1: Add `onBackToLibrary` prop and menu item**

Changes:
1. Add `Library` to lucide-react imports
2. Add `onBackToLibrary?` to props type
3. Add menu button inside the menu grid

```typescript
// Change the import to add Library icon
import {
  ChevronLeft,
  ChevronRight,
  Images,
  Library,           // ← ADD
  Maximize,
  Menu,
  // ... rest unchanged
} from "lucide-react";

// Add to props type (line 46-51)
type InteractivePdfFlipbookProps = {
  title: string;
  pdfPath: string;
  audioPath: string;
  timeline: AudioTimelineItem[];
  onBackToLibrary?: () => void;   // ← ADD
};

// Add to destructuring (line 65-70)
export function InteractivePdfFlipbook({
  title,
  pdfPath,
  audioPath,
  timeline,
  onBackToLibrary,               // ← ADD
}: InteractivePdfFlipbookProps) {

// Add button inside the menu div, before the closing </div> (after line 343, before </div> on line 344)
            <button
              type="button"
              onClick={onBackToLibrary}
              aria-label="Về thư viện"
              title="Về thư viện"
            >
              <Library aria-hidden="true" />
            </button>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/InteractivePdfFlipbook.tsx
git commit -m "feat: add back-to-library button in reader menu"
```

---

### Task 6: Verify the build

**Files:** N/A

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: finalize book list page implementation"
```
