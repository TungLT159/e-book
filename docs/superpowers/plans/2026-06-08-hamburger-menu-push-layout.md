# Hamburger Menu Push Layout - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign reader menu from fixed sidebar overlay to hamburger dropdown with push layout (no overlay).

**Architecture:** Replace fixed sidebar with hamburger button in header. Menu panel slides down (full-width) when opened, pushing PDF content down. Grid layout (header, menu, content) ensures no overlapping. Buttons show icon + text label. Responsive design for mobile/tablet/desktop.

**Tech Stack:** React, TypeScript, CSS Grid, Glassmorphism design system, lucide-react icons

---

## File Structure

### Files to Modify
1. `src/components/InteractivePdfFlipbook.tsx` - Remove old sidebar, add hamburger button, add menu panel JSX
2. `src/App.css` - Remove old sidebar CSS, add new menu panel CSS
3. `src/components/InteractivePdfFlipbook.test.tsx` - Update tests for new menu

### Files NOT Changed
- Side navigation buttons (`.interactive-reader__nav--prev/next`) - keep as-is
- TTS settings submenu structure - reuse existing
- All handlers (zoom, flip, narration, etc.) - keep as-is

---

## Tasks

### Task 1: Remove Old Sidebar CSS

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Remove old sidebar CSS classes**

Find and delete these CSS blocks (lines ~520-850):
```css
.interactive-reader__menu-sidebar { ... }
.interactive-reader__menu-section { ... }
.interactive-reader__menu-button { ... }
.interactive-reader__tooltip { ... }
.interactive-reader__tts-submenu { ... }
```

Also remove from responsive section (@media queries).

- [ ] **Step 2: Verify CSS compiles**

Run: `npm run build`
Expected: Build succeeds (may have unused CSS warnings, that's ok)

- [ ] **Step 3: Commit CSS removal**

```bash
git add src/App.css
git commit -m "refactor: remove old sidebar CSS"
```

---

### Task 2: Add New Menu Panel CSS

**Files:**
- Modify: `src/App.css` (add after line ~850, before Reduced Motion section)

- [ ] **Step 1: Add hamburger button CSS**

Add to `src/App.css`:

```css
/* ───── Reader: Hamburger Menu Toggle ───── */

.interactive-reader__menu-toggle {
  width: 48px;
  height: 48px;
  min-height: 48px;
  padding: 0;
  border-radius: var(--glass-radius-sm);
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--glass-blur-sm));
  -webkit-backdrop-filter: blur(var(--glass-blur-sm));
  border: var(--glass-border);
  color: var(--color-text);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 200ms ease;
  box-shadow: var(--glass-shadow);
}

.interactive-reader__menu-toggle:hover {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.interactive-reader__menu-toggle svg {
  width: 1.25rem;
  height: 1.25rem;
  stroke-width: 2;
}
```

- [ ] **Step 2: Add menu panel container CSS**

Add after hamburger button CSS:

```css
/* ───── Reader: Menu Panel (Dropdown) ───── */

.interactive-reader__menu-panel {
  position: relative;
  z-index: 5;
  width: 100%;
  overflow: hidden;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: var(--glass-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: max-height 250ms ease-out, opacity 250ms ease-out, padding 250ms ease-out;
}

.interactive-reader__menu-panel[data-state="closed"] {
  max-height: 0;
  opacity: 0;
  padding: 0 20px;
}

.interactive-reader__menu-panel[data-state="open"] {
  max-height: 200px;
  opacity: 1;
  padding: 16px 20px;
}
```

- [ ] **Step 3: Add menu sections layout CSS**

```css
.interactive-reader__menu-sections {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
}

.menu-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.menu-section:not(:last-child) {
  padding-right: 24px;
  border-right: 1px solid rgba(20, 20, 20, 0.2);
}

.menu-section__title {
  margin: 0 0 8px 0;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-secondary);
}
```

- [ ] **Step 4: Add menu button CSS**

```css
.menu-section button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  height: 48px;
  padding: 12px 16px;
  border-radius: var(--glass-radius-sm);
  border: var(--glass-border);
  background: var(--glass-bg);
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms ease;
  white-space: nowrap;
}

.menu-section button:hover:not(:disabled) {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(24, 86, 255, 0.25);
}

.menu-section button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.menu-section button svg {
  width: 1.2rem;
  height: 1.2rem;
  stroke-width: 2;
  flex-shrink: 0;
}
```

- [ ] **Step 5: Add responsive CSS**

```css
/* ───── Responsive: Menu Panel ───── */

@media (max-width: 768px) {
  .menu-section button {
    min-width: 100px;
    height: 44px;
    font-size: 0.85rem;
    padding: 10px 14px;
  }
  
  .interactive-reader__menu-sections {
    gap: 20px;
  }
  
  .menu-section:not(:last-child) {
    padding-right: 20px;
  }
}

@media (max-width: 480px) {
  .interactive-reader__menu-sections {
    flex-direction: column;
    gap: 16px;
  }
  
  .menu-section:not(:last-child) {
    padding-right: 0;
    padding-bottom: 16px;
    border-right: none;
    border-bottom: 1px solid rgba(20, 20, 20, 0.2);
  }
  
  .menu-section button {
    min-width: 80px;
    height: 40px;
    font-size: 0.8rem;
    padding: 8px 12px;
  }
  
  .menu-section button svg {
    width: 1rem;
    height: 1rem;
  }
}
```

- [ ] **Step 6: Update TTS submenu positioning**

Find `.interactive-reader__tts-submenu` (if it still exists) and update:

```css
.interactive-reader__tts-submenu {
  /* Keep existing styles, just update position */
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  /* Rest of existing styles... */
}
```

- [ ] **Step 7: Verify CSS compiles**

Run: `npm run build`
Expected: Build succeeds with no CSS errors

- [ ] **Step 8: Commit new menu CSS**

```bash
git add src/App.css
git commit -m "styles: add hamburger menu panel CSS"
```

---

### Task 3: Update Grid Layout CSS

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Update interactive-reader grid layout**

Find `.interactive-reader` class (around line ~317) and update:

```css
.interactive-reader {
  position: relative;
  display: grid;
  height: calc(100vh - 32px);
  height: calc(100dvh - 32px);
  grid-template-rows: auto auto minmax(0, 1fr);
  /* Row 1: Header (auto)
     Row 2: Menu panel (auto, can be 0)
     Row 3: Content (1fr) */
  max-width: 1320px;
  margin: 0 auto;
  padding: 16px;
  border-radius: var(--glass-radius);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: var(--glass-border);
  box-shadow: var(--glass-shadow);
  color: var(--color-text);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit grid layout update**

```bash
git add src/App.css
git commit -m "styles: update reader grid layout for menu panel"
```

---

### Task 4: Remove Old Sidebar JSX

**Files:**
- Modify: `src/components/InteractivePdfFlipbook.tsx`

- [ ] **Step 1: Find and remove old sidebar JSX**

Find the block starting with:
```jsx
{/* New Vertical Sidebar Menu */}
<div className="interactive-reader__menu-sidebar">
```

Delete the entire `<div className="interactive-reader__menu-sidebar">...</div>` block (approximately lines 1124-1360).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build fails with unused state/handler errors (we'll fix in next task)

- [ ] **Step 3: Commit sidebar removal**

```bash
git add src/components/InteractivePdfFlipbook.tsx
git commit -m "refactor: remove old sidebar JSX"
```

---

### Task 5: Add Menu State and Handlers

**Files:**
- Modify: `src/components/InteractivePdfFlipbook.tsx`

- [ ] **Step 1: Update state declarations**

Find the state declarations (around line 320). Replace:
```typescript
const [isTtsSettingsOpen, setIsTtsSettingsOpen] = useState(false);
```

With:
```typescript
const [isMenuOpen, setIsMenuOpen] = useState(false);
const [isTtsSettingsOpen, setIsTtsSettingsOpen] = useState(false);
```

- [ ] **Step 2: Add toggleMenu handler**

Find the handlers section (around line 608). Add after `toggleThumbnails`:

```typescript
const toggleMenu = useCallback(() => {
  setIsMenuOpen((prev) => {
    if (prev) {
      // Closing menu - also close TTS submenu
      setIsTtsSettingsOpen(false);
    }
    return !prev;
  });
}, []);
```

- [ ] **Step 3: Update ESC key handler**

Find the ESC key handler useEffect (around line 772). Update to:

```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;

    if (isTtsSettingsOpen) {
      closeTtsSettings();
    } else if (isMenuOpen) {
      toggleMenu();
    }
    
    setIsThumbnailPanelOpen(false);
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [isMenuOpen, isTtsSettingsOpen, toggleMenu, closeTtsSettings]);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds (no unused variable errors)

- [ ] **Step 5: Commit state and handlers**

```bash
git add src/components/InteractivePdfFlipbook.tsx
git commit -m "feat: add menu state and toggle handlers"
```

---

### Task 6: Add Hamburger Button to Header

**Files:**
- Modify: `src/components/InteractivePdfFlipbook.tsx`

- [ ] **Step 1: Add hamburger button to header**

Find the header JSX (around line 1070). Update to add hamburger button:

```jsx
<header className="interactive-reader__header">
  <div className="interactive-reader__title-group">
    {onBackToLibrary && (
      <button
        type="button"
        className="interactive-reader__library-back"
        onClick={onBackToLibrary}
        aria-label="Về thư viện"
        title="Về thư viện"
      >
        <ArrowLeft aria-hidden="true" />
        <span>Thư viện</span>
      </button>
    )}
    <h2>{title}</h2>
  </div>
  <p className="interactive-reader__status">
    Trang {currentPage} / {numPages || "-"}
  </p>
  
  {/* NEW: Hamburger Menu Toggle */}
  <button
    type="button"
    className="interactive-reader__menu-toggle"
    onClick={toggleMenu}
    aria-expanded={isMenuOpen}
    aria-label={isMenuOpen ? "Đóng menu điều khiển" : "Mở menu điều khiển"}
    title={isMenuOpen ? "Đóng menu điều khiển" : "Mở menu điều khiển"}
  >
    {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
  </button>
</header>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit hamburger button**

```bash
git add src/components/InteractivePdfFlipbook.tsx
git commit -m "feat: add hamburger menu toggle button to header"
```

---

### Task 7: Add Menu Panel JSX

**Files:**
- Modify: `src/components/InteractivePdfFlipbook.tsx`

- [ ] **Step 1: Add menu panel after header**

Find the line after `</header>` (around line 1095). Add menu panel:

```jsx
</header>

{/* Menu Panel (Dropdown) */}
<nav
  className="interactive-reader__menu-panel"
  role="navigation"
  aria-label="Menu điều khiển trình đọc"
  data-state={isMenuOpen ? "open" : "closed"}
>
  {isMenuOpen && (
    <div className="interactive-reader__menu-sections">
      {/* Section 1: Navigation */}
      <div className="menu-section menu-section--navigation">
        <h3 className="menu-section__title">Navigation</h3>
        <button
          type="button"
          onClick={flipToPreviousPage}
          disabled={currentPageIndex <= 0}
          aria-label="Trang trước"
          title="Trang trước"
        >
          <ChevronLeft aria-hidden="true" />
          Trang trước
        </button>
        <button
          type="button"
          onClick={flipToNextPage}
          disabled={!numPages || currentPageIndex >= numPages - 1}
          aria-label="Trang tiếp theo"
          title="Trang tiếp theo"
        >
          <ChevronRight aria-hidden="true" />
          Trang tiếp theo
        </button>
      </div>

      {/* Section 2: View Controls */}
      <div className="menu-section menu-section--view">
        <h3 className="menu-section__title">View</h3>
        <button
          type="button"
          onClick={() => changeZoom(1)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Phóng to"
          title="Phóng to"
        >
          <ZoomIn aria-hidden="true" />
          Phóng to
        </button>
        <button
          type="button"
          onClick={() => changeZoom(-1)}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Thu nhỏ"
          title="Thu nhỏ"
        >
          <ZoomOut aria-hidden="true" />
          Thu nhỏ
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
        >
          {isFullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
          {isFullscreen ? "Thoát" : "Toàn màn hình"}
        </button>
        <button
          type="button"
          onClick={toggleThumbnails}
          aria-label="Hình thu nhỏ"
          title="Hình thu nhỏ"
        >
          <Images aria-hidden="true" />
          Hình thu nhỏ
        </button>
      </div>

      {/* Section 3: Audio & Tools */}
      <div className="menu-section menu-section--audio">
        <h3 className="menu-section__title">Audio & Tools</h3>
        <button
          type="button"
          onClick={toggleNarration}
          disabled={!numPages || isNarrationLoading}
          aria-label={
            isNarrationSynthesizing
              ? "Đang tạo giọng đọc"
              : isNarrationEnabled
                ? "Dừng đọc"
                : "Đọc tự động"
          }
          title={
            isNarrationSynthesizing
              ? "Đang tạo giọng đọc"
              : isNarrationEnabled
                ? "Dừng đọc"
                : "Đọc tự động"
          }
        >
          {isNarrationEnabled ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {isNarrationEnabled ? "Dừng đọc" : "Đọc tự động"}
        </button>

        {/* TTS Settings with Submenu */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={toggleTtsSettings}
            aria-label="Cài đặt TTS"
            title="Cài đặt TTS"
            aria-expanded={isTtsSettingsOpen}
          >
            <Settings aria-hidden="true" />
            Cài đặt TTS
          </button>

          {isTtsSettingsOpen && (
            <div
              className="interactive-reader__tts-submenu"
              aria-label="Cài đặt TTS"
            >
              <div className="interactive-reader__tts-submenu-header">
                <h4>Cài đặt TTS</h4>
                <button
                  type="button"
                  className="interactive-reader__tts-submenu-close"
                  onClick={closeTtsSettings}
                  aria-label="Đóng"
                  title="Đóng"
                >
                  <X aria-hidden="true" />
                </button>
              </div>

              <label className="interactive-reader__tts-field">
                <span>Giọng đọc</span>
                <select
                  value={selectedVoice}
                  onChange={(event) => setSelectedVoice(event.target.value)}
                  disabled={isVoiceLoading || voiceOptions.length === 0}
                  aria-label="Giọng đọc"
                >
                  {voiceOptions.map((voice) => (
                    <option key={voice.value} value={voice.value}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="interactive-reader__tts-field">
                <span>Tốc độ đọc</span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={5}
                  value={speechRate}
                  onChange={(event) => setSpeechRate(Number(event.target.value))}
                  aria-label="Tốc độ đọc"
                />
                <output aria-live="polite">
                  {speechRate === 0
                    ? "Bình thường"
                    : `${speechRate > 0 ? "+" : ""}${speechRate}%`}
                </output>
              </label>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsAutoFlipEnabled((prev) => !prev)}
          disabled={!numPages || currentPageIndex >= numPages - 1}
          aria-label={isAutoFlipEnabled ? "Dừng tự lật" : "Tự lật trang"}
          title={isAutoFlipEnabled ? "Dừng tự lật" : "Tự lật trang"}
        >
          {isAutoFlipEnabled ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {isAutoFlipEnabled ? "Dừng tự lật" : "Tự lật"}
        </button>

        <button
          type="button"
          onClick={() => flipToPage(0)}
          disabled={!numPages || currentPageIndex <= 0}
          aria-label="Trang đầu"
          title="Trang đầu"
        >
          <SkipBack aria-hidden="true" />
          Trang đầu
        </button>

        <button
          type="button"
          onClick={() => flipToPage(numPages - 1)}
          disabled={!numPages || currentPageIndex >= numPages - 1}
          aria-label="Trang cuối"
          title="Trang cuối"
        >
          <SkipForward aria-hidden="true" />
          Trang cuối
        </button>
      </div>
    </div>
  )}
</nav>

{narrationError && (
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit menu panel JSX**

```bash
git add src/components/InteractivePdfFlipbook.tsx
git commit -m "feat: add menu panel JSX with 3 sections"
```

---

### Task 8: Update Tests

**Files:**
- Modify: `src/components/InteractivePdfFlipbook.test.tsx`

- [ ] **Step 1: Update tests to find hamburger button**

Find tests that look for "Mở menu điều khiển" and update them.

Example - find test "zooms the flipbook":
```typescript
it('zooms the flipbook within limits from the reader menu', async () => {
  render(<InteractivePdfFlipbook ... />);
  await screen.findByText('PDF page 1');

  const reader = screen.getByLabelText('Trình đọc tương tác cho Demo book');

  // Open menu first
  fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
  
  // Now buttons are visible
  fireEvent.click(screen.getByRole('button', { name: /phóng to/i }));
  expect(reader).toHaveStyle({ '--interactive-reader-zoom': '1.1' });
});
```

- [ ] **Step 2: Update tests for menu open/close**

Find any tests checking `isMenuOpen` state and update them to use hamburger button.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: Most tests pass (some may still need updates for new structure)

- [ ] **Step 4: Commit test updates**

```bash
git add src/components/InteractivePdfFlipbook.test.tsx
git commit -m "test: update tests for hamburger menu"
```

---

### Task 9: Manual Testing & Polish

**Files:**
- Manual testing only

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts, open http://localhost:5173

- [ ] **Step 2: Test hamburger button**

- Click hamburger (☰) → menu slides down
- Icon changes to (×)
- Click (×) → menu slides up
- Icon changes back to (☰)

Expected: Smooth animation, no glitches

- [ ] **Step 3: Test menu buttons**

Open menu, test each button:
- Prev/Next page buttons work
- Zoom in/out works
- Fullscreen works
- Thumbnails panel opens/closes
- Narration play/pause works
- TTS settings submenu opens
- Auto-flip works
- First/Last page buttons work

Expected: All functions work as before

- [ ] **Step 4: Test layout push**

- Open menu → PDF content area shrinks (pushed down)
- Close menu → PDF content area expands back
- No overlay/overlapping
- Smooth transition

Expected: Content pushes down cleanly

- [ ] **Step 5: Test responsive**

Resize browser:
- Desktop (> 768px): 3 sections horizontal
- Tablet (480-768px): 3 sections horizontal (may wrap)
- Mobile (< 480px): 3 sections vertical stack

Expected: Layout adjusts correctly

- [ ] **Step 6: Test keyboard navigation**

- Tab through buttons
- Enter/Space activates button
- ESC closes TTS submenu
- ESC closes menu

Expected: Keyboard works correctly

- [ ] **Step 7: Test TTS submenu**

- Open menu
- Click Settings button
- TTS submenu opens
- Change voice/speed
- Close submenu (X button or ESC)
- Close menu → submenu also closes

Expected: TTS submenu behaves correctly

- [ ] **Step 8: Document any issues**

If any issues found, note them for fixes.

---

### Task 10: Final Build & Commit

**Files:**
- All modified files

- [ ] **Step 1: Run final build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: Most tests pass (acceptable if some TTS tests need updates)

- [ ] **Step 3: Check git status**

Run: `git status`
Expected: All changes committed

- [ ] **Step 4: View commit log**

Run: `git log --oneline -10`
Expected: See all feature commits

- [ ] **Step 5: Create summary commit (if needed)**

If any small fixes were made during testing:

```bash
git add .
git commit -m "polish: final adjustments for hamburger menu"
```

---

## Summary

**Total Tasks:** 10
**Estimated Time:** 3-4 hours for experienced developer
**Complexity:** Medium (UI refactor with state management and layout changes)

**Key Changes:**
1. ✅ Removed fixed sidebar CSS and JSX
2. ✅ Added hamburger button in header
3. ✅ Added menu panel (full-width dropdown)
4. ✅ Updated grid layout (header, menu, content)
5. ✅ Menu pushes content down (no overlay)
6. ✅ Buttons show icon + text label
7. ✅ Responsive design (mobile/tablet/desktop)
8. ✅ All existing functionality preserved

**Testing Checklist:**
- [ ] Hamburger button toggles menu
- [ ] Menu slides down/up smoothly
- [ ] Icon changes: ☰ ↔ ×
- [ ] Content pushes down when menu opens
- [ ] Content expands when menu closes
- [ ] No overlay/overlapping
- [ ] All buttons work (zoom, flip, narration, etc.)
- [ ] TTS settings submenu works
- [ ] Responsive on mobile/tablet/desktop
- [ ] Keyboard navigation works
- [ ] ESC key closes submenu and menu
- [ ] Build succeeds
- [ ] Tests pass

---

## Troubleshooting

**Issue: Menu doesn't slide smoothly**
- Check CSS transition timing
- Verify `data-state` attribute changes correctly
- Check for conflicting CSS

**Issue: Content overlaps menu**
- Verify grid layout: `grid-template-rows: auto auto 1fr`
- Check z-index values
- Ensure menu panel is in correct grid row

**Issue: Buttons don't work**
- Verify handlers are passed correctly
- Check button disabled states
- Ensure event handlers are wired up

**Issue: Responsive layout broken**
- Check media queries (@media rules)
- Verify flex-direction changes on mobile
- Test on actual mobile device or DevTools

**Issue: Tests fail**
- Update test queries to find hamburger button first
- Open menu before clicking menu buttons
- Use `screen.getByRole('button', { name: /mở menu/i })`
