# Auto-Read Sleep Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a preset wall-clock sleep timer that displays an `MM:SS` countdown and fully stops automatic narration at expiry.

**Architecture:** Keep the timer in `useInteractivePdfFlipbook`, where narration lifecycle and stale-operation protection already live. Store an absolute deadline as the source of truth, use an interval only to refresh display state, and route timer expiry and existing stop paths through shared cleanup; pass the resulting state and handlers through existing menu and reader component props.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, `CustomSelect`, HTML media APIs

---

## File Structure

- Modify `src/components/hooks/useInteractivePdfFlipbook.ts`: own timer state, deadline/handle refs, timer setup and cleanup, and expose the timer API.
- Modify `src/components/InteractivePdfFlipbookMenu.tsx`: render the preset selector in the existing TTS settings submenu.
- Modify `src/components/InteractivePdfFlipbook.tsx`: wire timer props and render the countdown in the automatic narration bar.
- Modify `src/App.css`: style the countdown within the existing narration controls and preserve mobile layout.
- Modify `src/components/InteractivePdfFlipbook.tts.test.tsx`: cover selector availability, deadline behavior, cancellation, expiry cleanup, and stale synthesis.

### Task 1: Add The Preset Selector Contract

**Files:**
- Modify: `src/components/InteractivePdfFlipbookMenu.tsx:19-53,55-89,235-306`
- Modify: `src/components/InteractivePdfFlipbook.tsx:46-80`
- Test: `src/components/InteractivePdfFlipbook.tts.test.tsx`

- [ ] **Step 1: Write the failing selector availability test**

Add a test that opens TTS settings before narration, verifies the selector is disabled, starts narration, and verifies it becomes enabled with every approved option:

```tsx
it('enables the sleep timer presets only while automatic narration is active', async () => {
  render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);
  expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
  fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));

  const timerTrigger = screen.getByRole('button', { name: /hẹn giờ dừng đọc/i });
  expect(timerTrigger).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
  expect(timerTrigger).toBeEnabled();
  fireEvent.click(timerTrigger);

  for (const label of ['Tắt hẹn giờ', '5 phút', '10 phút', '15 phút', '30 phút', '45 phút', '60 phút']) {
    expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
  }
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx vitest run src/components/InteractivePdfFlipbook.tts.test.tsx -t "enables the sleep timer presets"
```

Expected: FAIL because no control named `Hẹn giờ dừng đọc` exists.

- [ ] **Step 3: Add the menu props and preset selector**

Add these props to `InteractivePdfFlipbookMenuProps` and its destructuring:

```ts
sleepTimerMinutes: number | null;
setSleepTimerMinutes: (minutes: number | null) => void;
```

Define the options outside the component:

```ts
const SLEEP_TIMER_OPTIONS: CustomSelectOption[] = [
  { value: 'off', label: 'Tắt hẹn giờ' },
  ...[5, 10, 15, 30, 45, 60].map((minutes) => ({
    value: String(minutes),
    label: `${minutes} phút`,
  })),
];
```

Render this after the volume field in the existing submenu:

```tsx
<CustomSelect
  label="Hẹn giờ dừng đọc"
  value={sleepTimerMinutes === null ? 'off' : String(sleepTimerMinutes)}
  options={SLEEP_TIMER_OPTIONS}
  onChange={(value) => setSleepTimerMinutes(value === 'off' ? null : Number(value))}
  disabled={!isNarrationEnabled}
  className="interactive-reader__tts-field"
/>
```

Temporarily pass a no-op contract from `InteractivePdfFlipbook` so the UI test can turn green before timer state is implemented:

```tsx
sleepTimerMinutes={null}
setSleepTimerMinutes={() => undefined}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npx vitest run src/components/InteractivePdfFlipbook.tts.test.tsx -t "enables the sleep timer presets"
```

Expected: PASS.

- [ ] **Step 5: Commit the selector contract**

```bash
git add src/components/InteractivePdfFlipbookMenu.tsx src/components/InteractivePdfFlipbook.tsx src/components/InteractivePdfFlipbook.tts.test.tsx
git commit -m "feat: add narration sleep timer presets"
```

### Task 2: Implement Absolute-Deadline Countdown State

**Files:**
- Modify: `src/components/hooks/useInteractivePdfFlipbook.ts:130-190,240-312,458-483,595-616,1376-1436`
- Modify: `src/components/InteractivePdfFlipbook.tsx:46-80,89-149`
- Test: `src/components/InteractivePdfFlipbook.tts.test.tsx`

- [ ] **Step 1: Write failing countdown and reset tests**

Add a small helper near the test setup:

```ts
function selectSleepTimer(label: string) {
  fireEvent.click(screen.getByRole('button', { name: /hẹn giờ dừng đọc/i }));
  fireEvent.click(screen.getByRole('option', { name: label }));
}
```

Add these tests. Switch to fake timers only after the PDF and initial playback have resolved, matching the existing timer-test pattern:

```tsx
it('shows wall-clock time remaining and resets the deadline when the preset changes', async () => {
  render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);
  expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
  fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
  await waitFor(() => expect(play).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));

  vi.useFakeTimers();
  selectSleepTimer('30 phút');
  expect(screen.getByText('30:00')).toBeInTheDocument();

  act(() => vi.advanceTimersByTime(1_000));
  expect(screen.getByText('29:59')).toBeInTheDocument();

  selectSleepTimer('5 phút');
  expect(screen.getByText('05:00')).toBeInTheDocument();
});

it('turns off the countdown without stopping narration', async () => {
  render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);
  expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
  fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
  await waitFor(() => expect(play).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));

  selectSleepTimer('5 phút');
  selectSleepTimer('Tắt hẹn giờ');

  expect(screen.queryByLabelText(/thời gian đọc còn lại/i)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npx vitest run src/components/InteractivePdfFlipbook.tts.test.tsx -t "countdown|turns off the countdown"
```

Expected: FAIL because the no-op menu props do not create timer state or countdown UI.

- [ ] **Step 3: Add timer types, state, refs, and formatting**

Extend `UseInteractivePdfFlipbookResult`:

```ts
sleepTimerMinutes: number | null;
sleepTimerRemainingSeconds: number | null;
setSleepTimerMinutes: (minutes: number | null) => void;
```

Add state and refs next to narration state/refs:

```ts
const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<number | null>(null);
const [sleepTimerRemainingSeconds, setSleepTimerRemainingSeconds] = useState<number | null>(null);
const sleepTimerDeadlineRef = useRef<number | null>(null);
const sleepTimerIntervalRef = useRef<number | null>(null);
const sleepTimerTimeoutRef = useRef<number | null>(null);
```

Add a pure formatter near the existing module-level helpers:

```ts
function formatSleepTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Add idempotent timer setup and cancellation**

Create timer cleanup before `stopNarration`:

```ts
const clearSleepTimer = useCallback(() => {
  if (sleepTimerIntervalRef.current !== null) {
    window.clearInterval(sleepTimerIntervalRef.current);
    sleepTimerIntervalRef.current = null;
  }
  if (sleepTimerTimeoutRef.current !== null) {
    window.clearTimeout(sleepTimerTimeoutRef.current);
    sleepTimerTimeoutRef.current = null;
  }
  sleepTimerDeadlineRef.current = null;
  setSleepTimerMinutesState(null);
  setSleepTimerRemainingSeconds(null);
}, []);
```

Add a temporary expiry callback that disables narration; Task 3 will consolidate the complete stop path:

```ts
const setSleepTimerMinutes = useCallback((minutes: number | null) => {
  clearSleepTimer();
  if (minutes === null || ![5, 10, 15, 30, 45, 60].includes(minutes)) return;

  const durationMs = minutes * 60_000;
  const deadline = Date.now() + durationMs;
  sleepTimerDeadlineRef.current = deadline;
  setSleepTimerMinutesState(minutes);
  setSleepTimerRemainingSeconds(minutes * 60);

  sleepTimerIntervalRef.current = window.setInterval(() => {
    if (sleepTimerDeadlineRef.current !== deadline) return;
    setSleepTimerRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
  }, 1_000);
  sleepTimerTimeoutRef.current = window.setTimeout(() => {
    if (sleepTimerDeadlineRef.current !== deadline) return;
    clearSleepTimer();
    setIsNarrationEnabled(false);
  }, durationMs);
}, [clearSleepTimer]);
```

Expose all three timer values in the hook return object. Replace the temporary no-op props in `InteractivePdfFlipbook` with:

```tsx
sleepTimerMinutes={state.sleepTimerMinutes}
setSleepTimerMinutes={state.setSleepTimerMinutes}
```

Render the countdown inside `interactive-reader__auto-read-bar`, before the preparing/controls branch, so it remains visible during synthesis:

```tsx
{state.sleepTimerRemainingSeconds !== null && (
  <output
    className="interactive-reader__sleep-timer"
    aria-label="Thời gian đọc còn lại"
    aria-live="off"
  >
    {formatSleepTimer(state.sleepTimerRemainingSeconds)}
  </output>
)}
```

Move `formatSleepTimer` to `InteractivePdfFlipbook.tsx` instead if it is only needed for rendering; do not duplicate it in both files.

- [ ] **Step 5: Run the focused countdown tests**

Run:

```bash
npx vitest run src/components/InteractivePdfFlipbook.tts.test.tsx -t "countdown|turns off the countdown"
```

Expected: PASS.

- [ ] **Step 6: Commit the deadline countdown**

```bash
git add src/components/hooks/useInteractivePdfFlipbook.ts src/components/InteractivePdfFlipbook.tsx src/components/InteractivePdfFlipbook.tts.test.tsx
git commit -m "feat: track narration sleep timer deadline"
```

### Task 3: Unify Expiry And Narration Cleanup

**Files:**
- Modify: `src/components/hooks/useInteractivePdfFlipbook.ts:458-483,595-690,969-980,1123-1324`
- Test: `src/components/InteractivePdfFlipbook.tts.test.tsx`

- [ ] **Step 1: Write failing expiry cleanup tests**

Add tests for complete stop and wall-clock behavior while paused:

```tsx
it('fully stops narration when the sleep timer expires while paused', async () => {
  render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);
  expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
  fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
  await waitFor(() => expect(play).toHaveBeenCalled());
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));
  selectSleepTimer('5 phút');
  fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));
  act(() => vi.advanceTimersByTime(5 * 60_000));

  expect(screen.queryByRole('group', { name: /điều khiển đọc tự động/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeInTheDocument();
  expect(screen.queryByLabelText(/thời gian đọc còn lại/i)).not.toBeInTheDocument();
  expect(pause).toHaveBeenCalled();
  expect(load).toHaveBeenCalled();
});
```

Add a second test that starts a 5-minute timer, fires `ended`, pauses narration during the 1.5-second inter-page delay so the pending target is retained, advances to expiry, then attempts to resume and advances another `NARRATION_PAGE_PAUSE_MS + FLIPPING_TIME`; assert page 2 was never requested or shown. This proves expiry clears `narrationPagePauseTimeoutRef` and `pendingNarrationPageIndexRef`.

- [ ] **Step 2: Run the expiry tests and verify failure**

Run:

```bash
npx vitest run src/components/InteractivePdfFlipbook.tts.test.tsx -t "sleep timer expires|expiry clears the pending narration transition"
```

Expected: at least the complete audio reset or pending transition assertion FAILS because Task 2 only toggles narration state.

- [ ] **Step 3: Route expiry and manual stop through one function**

Change `stopNarration` to clear the sleep timer and disable narration itself:

```ts
const stopNarration = useCallback(() => {
  clearSleepTimer();
  narrationRequestIdRef.current += 1;
  narrationPlaybackOperationIdRef.current += 1;
  narrationPreloadRequestIdRef.current += 1;
  pendingNarrationPageIndexRef.current = null;

  if (narrationPagePauseTimeoutRef.current !== null) {
    window.clearTimeout(narrationPagePauseTimeoutRef.current);
    narrationPagePauseTimeoutRef.current = null;
  }

  const audio = narrationAudioRef.current;
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }

  if (narrationBlobUrlRef.current) {
    URL.revokeObjectURL(narrationBlobUrlRef.current);
    narrationBlobUrlRef.current = null;
  }

  isNarrationPausedRef.current = false;
  setIsNarrationEnabled(false);
  setIsNarrationPaused(false);
  setIsNarrationLoading(false);
  setIsNarrationSynthesizing(false);
}, [clearSleepTimer]);
```

Avoid the callback cycle between timer setup and `stopNarration` by storing the current stop callback in a ref:

```ts
const stopNarrationRef = useRef<() => void>(() => undefined);
stopNarrationRef.current = stopNarration;
```

Use it in the expiry timeout:

```ts
sleepTimerTimeoutRef.current = window.setTimeout(() => {
  if (sleepTimerDeadlineRef.current !== deadline) return;
  stopNarrationRef.current();
}, durationMs);
```

Replace the manual-stop branch in `toggleNarration` with `stopNarration()` and add it to dependencies. Replace error/end paths that currently only call `setIsNarrationEnabled(false)` with `stopNarration()` after setting any required error message. Keep successful end-of-book silent.

- [ ] **Step 4: Add unmount-safe cleanup**

Add an effect whose cleanup clears browser handles without setting React state after unmount:

```ts
useEffect(() => () => {
  if (sleepTimerIntervalRef.current !== null) window.clearInterval(sleepTimerIntervalRef.current);
  if (sleepTimerTimeoutRef.current !== null) window.clearTimeout(sleepTimerTimeoutRef.current);
}, []);
```

The existing PDF-change path already calls `stopNarration`; verify it now clears timer state as part of the same operation.

- [ ] **Step 5: Run the complete TTS test file**

Run:

```bash
npx vitest run src/components/InteractivePdfFlipbook.tts.test.tsx
```

Expected: all tests PASS, including existing pause, resume, end-of-book, audio error, and stale-operation tests.

- [ ] **Step 6: Commit unified cleanup**

```bash
git add src/components/hooks/useInteractivePdfFlipbook.ts src/components/InteractivePdfFlipbook.tts.test.tsx
git commit -m "feat: stop narration when sleep timer expires"
```

### Task 4: Cover Replacement, Stale Synthesis, And Independent Auto-Flip

**Files:**
- Modify: `src/components/InteractivePdfFlipbook.tts.test.tsx`
- Modify only if a test exposes a defect: `src/components/hooks/useInteractivePdfFlipbook.ts`

- [ ] **Step 1: Add the remaining integration tests**

Add focused tests using existing deferred preparation helpers and fake-timer conventions:

```tsx
it('does not play a synthesis result that resolves after sleep timer expiry', async () => {
  let resolvePreparation!: (result: AudioCacheResult) => void;
  prepareEdgeTtsAudioCacheFile.mockReturnValueOnce(new Promise((resolve) => {
    resolvePreparation = resolve;
  }));

  render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);
  expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
  fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
  fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));
  selectSleepTimer('5 phút');

  vi.useFakeTimers();
  act(() => vi.advanceTimersByTime(5 * 60_000));
  await act(async () => {
    resolvePreparation({
      audioPath: 'C:\\Temp\\late.mp3',
      audioUrl: 'file:///C:/Temp/late.mp3',
      cacheHit: false,
    });
    await Promise.resolve();
  });

  expect(play).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeInTheDocument();
});
```

Use the actual cache result type already declared in the test file rather than introducing `AudioCacheResult` if that name does not exist.

Add one test that starts narration, selects the 5-minute timer, enables independent auto-flip immediately before expiry, advances through expiry, and asserts narration controls are gone while the auto-flip button still reads `Dừng tự lật`. Advance one `AUTO_FLIP_INTERVAL` and assert the visible page advances. This avoids allowing auto-flip to reach the final page during the five-minute countdown. Add one test that manually clicks `Dừng đọc`, advances beyond the old deadline, starts narration again, and confirms the old timer cannot stop the new session.

- [ ] **Step 2: Run the new tests and verify their results**

Run:

```bash
npx vitest run src/components/InteractivePdfFlipbook.tts.test.tsx -t "resolves after sleep timer expiry|independent auto-flip|old sleep timer"
```

Expected: PASS if Task 3 cleanup and generation invalidation are complete. If one fails, make only the smallest hook correction required by that assertion and rerun until PASS.

- [ ] **Step 3: Run the full narration regression suite**

Run:

```bash
npx vitest run src/components/InteractivePdfFlipbook.tts.test.tsx src/components/InteractivePdfFlipbook.test.tsx
```

Expected: both test files PASS.

- [ ] **Step 4: Commit edge-case coverage**

```bash
git add src/components/InteractivePdfFlipbook.tts.test.tsx src/components/hooks/useInteractivePdfFlipbook.ts
git commit -m "test: cover narration sleep timer edge cases"
```

### Task 5: Style And Final Verification

**Files:**
- Modify: `src/App.css:890-979,1613-1625`
- Modify if markup needs a wrapper: `src/components/InteractivePdfFlipbook.tsx:89-149`

- [ ] **Step 1: Add countdown styling**

Keep the timer compact and compatible with the existing doodle controls:

```css
.interactive-reader__sleep-timer {
  flex: 0 0 auto;
  min-width: 5.25rem;
  padding: 8px 12px;
  border: var(--doodle-border-thin);
  border-radius: var(--doodle-radius-sm);
  background: var(--color-surface);
  color: var(--color-focus);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  text-align: center;
}
```

Ensure `.interactive-reader__auto-read-bar` can place the timer and status/controls without overflow:

```css
.interactive-reader__auto-read-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
```

Within the existing mobile media query, allow the timer and controls to fit a narrow viewport without horizontal scrolling:

```css
.interactive-reader__sleep-timer {
  padding: 6px 10px;
}
```

- [ ] **Step 2: Run all automated tests**

Run:

```bash
npm test
```

Expected: all test files and tests PASS. The known PDF standard-font warning may remain, but there must be no failed test.

- [ ] **Step 3: Build the production application**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build successfully. The existing large-chunk warning is acceptable; no build error is acceptable.

- [ ] **Step 4: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors; only sleep-timer source, test, CSS, and generated tracked build files are modified.

- [ ] **Step 5: Commit the completed UI and generated build output**

```bash
git add src/App.css src/components/InteractivePdfFlipbook.tsx dist
git commit -m "style: display narration sleep timer countdown"
```

- [ ] **Step 6: Verify a clean final state**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: the working tree is clean and the sleep-timer commits are visible in recent history.
