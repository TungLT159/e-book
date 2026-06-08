# Hamburger Menu với Push Layout - Reader Menu Redesign v2

> **Design Specification**  
> Date: 2026-06-08  
> Status: Approved for Implementation

---

## 1. Overview

**Goal:** Thiết kế lại menu trình đọc PDF từ fixed sidebar (đè lên content) sang hamburger dropdown menu với push layout (không đè lên content).

**Current State:**
- Menu là fixed vertical sidebar bên phải (80px wide)
- Luôn hiển thị, đè lên PDF content
- Icon-only buttons với tooltips
- TTS settings trong submenu popup

**Desired State:**
- Hamburger button trong header (góc phải)
- Menu dropdown full-width khi mở
- Content PDF được push xuống (không overlay)
- Buttons có icon + text label rõ ràng
- Layout responsive tốt cho mobile

---

## 2. Layout Structure

### 2.1 Grid Layout

**Container Structure:**
```css
.interactive-reader {
  display: grid;
  grid-template-rows: auto auto 1fr;
  /* Row 1: Header (always visible)
     Row 2: Menu panel (conditional)
     Row 3: PDF Content (flexible) */
  height: 100vh;
}
```

### 2.2 State: Menu Closed

```
┌────────────────────────────────────────┐
│  [< Thư viện] [Title]  [Trang 1/10] [☰]│  ← Header (Row 1)
├────────────────────────────────────────┤
│                                        │
│  [< Prev]    [PDF CONTENT]    [Next >]│  ← Content (Row 3, full height)
│                                        │
│                                        │
└────────────────────────────────────────┘
```

- Row 1: Header (auto height ~60px)
- Row 2: Hidden (height: 0, overflow: hidden)
- Row 3: Content (1fr - chiếm toàn bộ còn lại)

### 2.3 State: Menu Open

```
┌────────────────────────────────────────┐
│  [< Thư viện] [Title]  [Trang 1/10] [×]│  ← Header (Row 1)
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ Navigation:                        │ │
│ │ [< Prev] [Next >]                  │ │
│ │                                    │ │
│ │ View Controls:                     │ │  ← Menu Panel (Row 2)
│ │ [+ Zoom] [- Zoom] [⛶ Full] [📷]   │ │
│ │                                    │ │
│ │ Audio & Tools:                     │ │
│ │ [▶ Play] [⚙️ TTS] [⏮] [⏭]        │ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│                                        │
│  [< Prev]    [PDF CONTENT]    [Next >]│  ← Content (Row 3, pushed down)
│                     ↓ (smaller)        │
└────────────────────────────────────────┘
```

- Row 1: Header (auto height ~60px)
- Row 2: Menu panel (auto height, max 200px)
- Row 3: Content (1fr - co lại để nhường chỗ)

---

## 3. Menu Panel Design

### 3.1 Layout - 3 Sections Horizontal

**Desktop Layout (> 768px):**
```
┌─────────────────┬──────────────────┬─────────────────┐
│  Navigation     │  View Controls   │  Audio & Tools  │
│  [< Prev]       │  [+ Zoom In]     │  [▶ Play]       │
│  [Next >]       │  [- Zoom Out]    │  [⚙️ Settings]  │
│                 │  [⛶ Fullscreen]  │  [⏮ Auto-flip]  │
│                 │  [📷 Thumbnails] │  [⏭ First/Last] │
└─────────────────┴──────────────────┴─────────────────┘
```

**Section Dividers:** 
- Vertical line (1px, 20% opacity) giữa sections
- Padding: 0 24px giữa sections

### 3.2 Button Specifications

**Desktop (> 768px):**
- Button size: 48x48px (min-width: 120px với text)
- Layout: Icon (left) + Text label (right)
- Icon size: 1.2rem (20px)
- Text: 0.9rem, font-weight 500
- Gap: 8px giữa icon và text
- Padding: 12px 16px

**Tablet (480-768px):**
- Button size: 44x44px (min-width: 100px)
- Text: 0.85rem, font-weight 500
- Sections có thể wrap nếu không vừa

**Mobile (< 480px):**
- Button size: 40x40px (min-width: 80px)
- Text: 0.8rem, font-weight 500
- Layout: 3 sections stack vertically (column)
- Gap giữa sections: 16px

### 3.3 Section Content

#### **Section 1: Navigation**
```html
<div class="menu-section menu-section--navigation">
  <h3 class="menu-section__title">Navigation</h3>
  <button aria-label="Trang trước" disabled={currentPage <= 1}>
    <ChevronLeft /> Trang trước
  </button>
  <button aria-label="Trang tiếp theo" disabled={currentPage >= totalPages}>
    <ChevronRight /> Trang tiếp theo
  </button>
</div>
```

#### **Section 2: View Controls**
```html
<div class="menu-section menu-section--view">
  <h3 class="menu-section__title">View</h3>
  <button aria-label="Phóng to" onClick={zoomIn} disabled={zoom >= MAX_ZOOM}>
    <ZoomIn /> Phóng to
  </button>
  <button aria-label="Thu nhỏ" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}>
    <ZoomOut /> Thu nhỏ
  </button>
  <button aria-label="Toàn màn hình" onClick={toggleFullscreen}>
    {isFullscreen ? <Minimize /> : <Maximize />}
    {isFullscreen ? "Thoát" : "Toàn màn hình"}
  </button>
  <button aria-label="Hình thu nhỏ" onClick={toggleThumbnails}>
    <Images /> Hình thu nhỏ
  </button>
</div>
```

#### **Section 3: Audio & Tools**
```html
<div class="menu-section menu-section--audio">
  <h3 class="menu-section__title">Audio & Tools</h3>
  <button aria-label="Đọc tự động" onClick={toggleNarration} disabled={!numPages}>
    {isNarrationEnabled ? <Pause /> : <Play />}
    {isNarrationEnabled ? "Dừng đọc" : "Đọc tự động"}
  </button>
  
  <!-- TTS Settings with Submenu -->
  <div style={{ position: "relative" }}>
    <button aria-label="Cài đặt TTS" onClick={toggleTtsSettings}>
      <Settings /> Cài đặt TTS
    </button>
    {isTtsSettingsOpen && (
      <div class="menu-tts-submenu">
        <!-- Voice & Speed controls (same as before) -->
      </div>
    )}
  </div>
  
  <button aria-label="Tự lật trang" onClick={toggleAutoFlip}>
    {isAutoFlipEnabled ? <Pause /> : <Play />}
    {isAutoFlipEnabled ? "Dừng tự lật" : "Tự lật"}
  </button>
  <button aria-label="Trang đầu" onClick={() => goToPage(0)} disabled={currentPage <= 1}>
    <SkipBack /> Trang đầu
  </button>
  <button aria-label="Trang cuối" onClick={() => goToPage(totalPages - 1)} disabled={currentPage >= totalPages}>
    <SkipForward /> Trang cuối
  </button>
</div>
```

---

## 4. Header Changes

### 4.1 Current Header
```html
<header class="interactive-reader__header">
  <div class="interactive-reader__title-group">
    <button class="interactive-reader__library-back">
      <ArrowLeft /> Thư viện
    </button>
    <h2>Title</h2>
  </div>
  <p class="interactive-reader__status">Trang 1 / 10</p>
</header>

<!-- Old sidebar (to be removed) -->
<div class="interactive-reader__menu-sidebar">...</div>
```

### 4.2 New Header
```html
<header class="interactive-reader__header">
  <div class="interactive-reader__title-group">
    <button class="interactive-reader__library-back">
      <ArrowLeft /> Thư viện
    </button>
    <h2>Title</h2>
  </div>
  <p class="interactive-reader__status">Trang 1 / 10</p>
  
  <!-- NEW: Hamburger Toggle -->
  <button 
    class="interactive-reader__menu-toggle"
    onClick={toggleMenu}
    aria-expanded={isMenuOpen}
    aria-label={isMenuOpen ? "Đóng menu" : "Mở menu"}
  >
    {isMenuOpen ? <X /> : <Menu />}
  </button>
</header>
```

### 4.3 Header Layout
```css
.interactive-reader__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 16px;
}

.interactive-reader__menu-toggle {
  width: 48px;
  height: 48px;
  border-radius: var(--glass-radius-sm);
  background: var(--glass-bg);
  border: var(--glass-border);
  /* Same styling as other header buttons */
}
```

---

## 5. CSS Structure

### 5.1 Menu Panel Container

```css
.interactive-reader__menu-panel {
  position: relative;
  z-index: 5;
  width: 100%;
  max-height: 200px;
  overflow: auto;
  padding: 16px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: var(--glass-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  
  /* Animation */
  transition: max-height 250ms ease-out, opacity 250ms ease-out;
}

.interactive-reader__menu-panel[data-state="closed"] {
  max-height: 0;
  opacity: 0;
  padding: 0 20px;
  overflow: hidden;
}

.interactive-reader__menu-panel[data-state="open"] {
  max-height: 200px;
  opacity: 1;
}
```

### 5.2 Menu Sections Layout

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

### 5.3 Menu Buttons

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

### 5.4 Responsive Layout

```css
/* Tablet: 480-768px */
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
}

/* Mobile: < 480px */
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

---

## 6. State Management

### 6.1 React State

```typescript
const [isMenuOpen, setIsMenuOpen] = useState(false);
const [isTtsSettingsOpen, setIsTtsSettingsOpen] = useState(false);
```

### 6.2 Handlers

```typescript
const toggleMenu = useCallback(() => {
  setIsMenuOpen(prev => {
    if (prev) {
      // Closing menu - also close TTS submenu
      setIsTtsSettingsOpen(false);
    }
    return !prev;
  });
}, []);

const toggleTtsSettings = useCallback(() => {
  setIsTtsSettingsOpen(prev => !prev);
}, []);

const closeTtsSettings = useCallback(() => {
  setIsTtsSettingsOpen(false);
}, []);
```

### 6.3 Keyboard Handlers

```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      if (isTtsSettingsOpen) {
        closeTtsSettings();
      } else if (isMenuOpen) {
        toggleMenu();
      }
    }
  };
  
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [isMenuOpen, isTtsSettingsOpen, toggleMenu, closeTtsSettings]);
```

---

## 7. Interactions & Behaviors

### 7.1 Opening Menu
1. User clicks hamburger button (☰) in header
2. `isMenuOpen` becomes `true`
3. Menu panel slides down (250ms ease-out)
4. Hamburger icon changes to close icon (×)
5. PDF content area shrinks to accommodate menu

### 7.2 Closing Menu
1. User clicks close button (×) in header
2. `isMenuOpen` becomes `false`
3. TTS submenu closes (if open)
4. Menu panel slides up (200ms ease-in)
5. Close icon changes back to hamburger (☰)
6. PDF content area expands back to full height

### 7.3 TTS Settings Submenu
- Click Settings button → submenu popup opens (same as current)
- Position: absolute, right-aligned within menu panel
- Click outside or ESC → closes submenu
- Closing main menu → also closes submenu

### 7.4 Click Outside
- Clicking outside menu panel → **does NOT close** menu
- This prevents accidental closes when interacting with PDF

### 7.5 ESC Key
- If TTS submenu open → closes TTS submenu only
- If menu open (no submenu) → closes menu
- Priority: submenu first, then menu

---

## 8. Accessibility

### 8.1 ARIA Attributes

**Hamburger Button:**
```html
<button
  class="interactive-reader__menu-toggle"
  aria-expanded={isMenuOpen}
  aria-label={isMenuOpen ? "Đóng menu điều khiển" : "Mở menu điều khiển"}
>
  {isMenuOpen ? <X /> : <Menu />}
</button>
```

**Menu Panel:**
```html
<nav
  class="interactive-reader__menu-panel"
  role="navigation"
  aria-label="Menu điều khiển trình đọc"
  data-state={isMenuOpen ? "open" : "closed"}
>
  {/* sections */}
</nav>
```

**Section Titles:**
```html
<h3 class="menu-section__title" id="nav-section-title">
  Navigation
</h3>
<div role="group" aria-labelledby="nav-section-title">
  {/* buttons */}
</div>
```

### 8.2 Keyboard Navigation
- Tab: Navigate through buttons in order
- Enter/Space: Activate button
- ESC: Close TTS submenu or menu
- Focus visible: 2px blue outline, 2px offset

### 8.3 Screen Reader
- Menu panel has role="navigation"
- Section titles are h3 for proper heading hierarchy
- All buttons have aria-label
- State changes announced (aria-live for dynamic content)

---

## 9. Animation Specifications

### 9.1 Menu Panel

**Open Animation:**
```css
@keyframes menu-slide-down {
  from {
    max-height: 0;
    opacity: 0;
  }
  to {
    max-height: 200px;
    opacity: 1;
  }
}

.interactive-reader__menu-panel[data-state="opening"] {
  animation: menu-slide-down 250ms ease-out forwards;
}
```

**Close Animation:**
```css
@keyframes menu-slide-up {
  from {
    max-height: 200px;
    opacity: 1;
  }
  to {
    max-height: 0;
    opacity: 0;
  }
}

.interactive-reader__menu-panel[data-state="closing"] {
  animation: menu-slide-up 200ms ease-in forwards;
}
```

### 9.2 Button Interactions
- Hover: background color transition 200ms ease
- Click: scale down to 0.95x, duration 100ms
- Disabled: no animation

### 9.3 Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  .interactive-reader__menu-panel,
  .menu-section button {
    animation: none !important;
    transition: none !important;
  }
}
```

---

## 10. Migration Path

### 10.1 Changes to Existing Code

**Remove:**
1. `.interactive-reader__menu-sidebar` (fixed sidebar)
2. `.interactive-reader__menu-sidebar` CSS
3. Old sidebar JSX in InteractivePdfFlipbook.tsx

**Keep:**
1. Side navigation buttons (`.interactive-reader__nav--prev/next`)
2. TTS settings submenu structure
3. All existing handlers (zoom, flip, narration, etc.)

**Add:**
1. Hamburger button in header
2. Menu panel component (full-width dropdown)
3. New CSS for menu panel and sections
4. `isMenuOpen` state and `toggleMenu` handler

### 10.2 Implementation Steps
1. Add hamburger button to header
2. Create menu panel component with 3 sections
3. Add CSS for menu panel, sections, buttons
4. Wire up state management
5. Add animations
6. Test responsive on mobile/tablet
7. Remove old sidebar code
8. Update tests

---

## 11. Testing Checklist

### 11.1 Functional Tests
- [ ] Hamburger button toggles menu open/close
- [ ] Menu slides down smoothly (250ms)
- [ ] Menu slides up smoothly (200ms)
- [ ] Icon changes: ☰ ↔ ×
- [ ] All buttons work (zoom, flip, narration, etc.)
- [ ] TTS settings submenu opens/closes
- [ ] ESC key closes TTS submenu
- [ ] ESC key closes menu (when submenu not open)
- [ ] Closing menu also closes TTS submenu
- [ ] Disabled states work correctly

### 11.2 Layout Tests
- [ ] PDF content pushes down when menu opens
- [ ] PDF content expands when menu closes
- [ ] No overlay - content and menu don't overlap
- [ ] Grid layout works correctly
- [ ] Menu max-height constraint works (200px)

### 11.3 Responsive Tests
- [ ] Desktop (> 768px): 3 sections horizontal, buttons 48px
- [ ] Tablet (480-768px): 3 sections horizontal (wrap), buttons 44px
- [ ] Mobile (< 480px): 3 sections vertical stack, buttons 40px
- [ ] Text labels visible on all screen sizes
- [ ] Sections wrap/stack correctly

### 11.4 Accessibility Tests
- [ ] Hamburger has aria-expanded
- [ ] Menu has role="navigation"
- [ ] All buttons have aria-label
- [ ] Keyboard navigation works (Tab, Enter, ESC)
- [ ] Focus visible on all interactive elements
- [ ] Screen reader announces state changes

---

## 12. Edge Cases & Considerations

### 12.1 Performance
- Menu animation is CSS-based (GPU-accelerated)
- No JavaScript calculations during animation
- Content reflow happens once (not continuously)

### 12.2 Fullscreen Mode
- Menu still accessible in fullscreen
- Layout adjusts appropriately
- Hamburger button remains visible

### 12.3 Very Long Content
- Menu panel has max-height: 200px
- Overflow: auto if content exceeds
- Scroll within menu if needed

### 12.4 TTS Submenu Positioning
- Submenu is absolute positioned
- If menu panel scrolls, submenu scrolls with it
- Z-index ensures submenu is above buttons

### 12.5 Rapid Toggle
- Animation can be interrupted mid-way
- State transitions are handled correctly
- No visual glitches from rapid clicking

---

## 13. Design Tokens (Glassmorphism)

All existing design tokens are preserved:

```css
--glass-bg:           rgba(255, 255, 255, 0.55);
--glass-bg-strong:    rgba(255, 255, 255, 0.78);
--glass-blur:         16px;
--glass-blur-sm:      8px;
--glass-border:       1px solid rgba(255, 255, 255, 0.35);
--glass-shadow:       0 8px 32px rgba(0, 0, 0, 0.08);
--glass-radius:       16px;
--glass-radius-sm:    10px;
--color-primary:      #1856FF;
--color-text:         #141414;
--color-secondary:    #3A344E;
```

---

## 14. Success Criteria

✅ Menu không đè lên PDF content  
✅ Layout push xuống mượt mà (no jank)  
✅ Hamburger button rõ ràng, dễ nhìn  
✅ All buttons có icon + text label  
✅ Responsive tốt trên mobile  
✅ Animations smooth (250ms/200ms)  
✅ Accessibility compliant (ARIA, keyboard)  
✅ Build không có lỗi  
✅ Tests pass (sau khi update)

---

## 15. Notes

- Old sidebar removal: Loại bỏ hoàn toàn `.interactive-reader__menu-sidebar`
- Side nav buttons: Giữ nguyên (không liên quan đến menu panel)
- TTS submenu: Giữ nguyên cấu trúc, chỉ thay đổi container
- Header layout: Thêm hamburger button, không thay đổi title/status
