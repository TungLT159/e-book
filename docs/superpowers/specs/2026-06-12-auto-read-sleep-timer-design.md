# Auto-Read Sleep Timer Design

## Goal

Add a session-scoped sleep timer to automatic PDF narration. The reader can choose a preset duration while narration is active, see the remaining wall-clock time, and have narration stop completely when the deadline is reached.

## Requirements

- Offer `5`, `10`, `15`, `30`, `45`, and `60` minute presets plus `Off`.
- Allow timer selection only while automatic narration is enabled.
- Start or restart the countdown immediately when a duration is selected.
- Count wall-clock time, including narration pauses, speech synthesis, and delays between pages.
- Show the remaining time as `MM:SS` in the automatic narration control bar. A 60-minute timer begins at `60:00`.
- Selecting `Off` removes the timer without interrupting narration.
- Replacing one preset with another creates a new deadline from the time of selection.
- At expiry, stop automatic narration completely. Do not stop the independent automatic page-flip feature.
- Do not persist the timer across reader sessions, document changes, unmounts, or application restarts.

## Architecture

The timer belongs in `useInteractivePdfFlipbook`, alongside the existing narration state and cleanup logic. The Electron process does not need new IPC because narration playback and its lifecycle already live in the renderer.

The hook will expose the selected duration, remaining seconds, and a duration-change handler to the existing menu and reader components. React state drives rendering, while refs hold timer handles and the absolute deadline for callbacks that must not depend on stale closures.

The implementation will use an absolute deadline based on `Date.now()` rather than decrementing state as the source of truth. This prevents accumulated drift when Chromium throttles callbacks, the renderer is busy, or the computer temporarily sleeps.

## Components

### Narration Hook

`useInteractivePdfFlipbook` will own:

- The selected sleep-timer duration in minutes, with `null` meaning off.
- The absolute expiry timestamp.
- The remaining whole seconds displayed by the UI.
- A one-second display interval.
- An expiry timeout that invokes the narration stop path at the deadline.

Remaining time is calculated as:

```ts
Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
```

The interval only refreshes display state. The expiry timeout is responsible for stopping narration, so display scheduling and expiry behavior remain independent.

Narration stopping should use a single cleanup contract shared by manual stop and timer expiry. It must invalidate in-flight narration operations, stop and reset audio, clear a pending inter-page transition, and reset narration pause/loading state. Late speech-synthesis results may still populate the cache, but they must be considered stale and must never begin playback.

### Settings Menu

The existing voice settings submenu will include a labeled `Hẹn giờ dừng đọc` selector with these options:

- `Tắt hẹn giờ`
- `5 phút`
- `10 phút`
- `15 phút`
- `30 phút`
- `45 phút`
- `60 phút`

The selector is disabled unless automatic narration is enabled. It should follow the existing `CustomSelect` and TTS field patterns rather than introducing a new control system.

### Automatic Narration Bar

While a timer is active, the automatic narration bar displays the remaining time as `MM:SS`. It remains visible and continues updating while narration is paused, speech is being synthesized, or the reader is waiting to move to the next page.

When the timer is off, no countdown is rendered. At expiry, narration is disabled, so the existing narration bar closes naturally. Expiry is an expected action and does not produce an error message.

## Data Flow

1. The user starts automatic narration.
2. The sleep-timer selector becomes enabled.
3. The user chooses a preset duration.
4. The hook records `Date.now() + duration`, calculates the initial remaining seconds, starts the display interval, and schedules expiry.
5. Each display tick recalculates remaining seconds from the absolute deadline.
6. Pausing, resuming, navigating narration pages, changing voice, changing rate, or changing volume leaves the deadline unchanged.
7. Selecting another duration replaces the deadline and both scheduled timers.
8. Selecting `Off` clears the deadline, timers, and countdown without stopping narration.
9. At expiry, the hook clears timer state and fully stops narration.

## Cleanup And Edge Cases

The sleep timer is cleared when:

- The user manually stops narration.
- Narration reaches the end of the document.
- Narration fails during extraction, synthesis, playback, or resume.
- The PDF changes.
- The reader unmounts.
- The user explicitly selects `Off`.

Expiry during the inter-page delay must clear both the transition timeout and pending target page so the book cannot flip after narration has stopped.

Expiry during speech synthesis does not need process-level cancellation. Existing generation and operation identifiers will invalidate the result when it returns.

The independent automatic page-flip interval is outside the sleep timer's scope and continues unchanged.

## Error Handling

- Timer expiry and explicit timer cancellation are normal actions and do not set `narrationError`.
- Invalid timer values cannot originate from the UI because only fixed options are exposed.
- Timer cleanup is idempotent so multiple stop paths can safely call it.
- A delayed interval tick must not restart a cleared or replaced timer; callbacks verify the current deadline before updating state.

## Testing

Use Vitest, Testing Library, mocked media methods, and fake timers, following the existing narration tests.

Cover these behaviors:

- The timer selector is disabled before automatic narration starts and enabled afterward.
- All six presets and `Off` are available.
- Selecting a preset shows the expected initial `MM:SS` value.
- Remaining time is recalculated from the deadline and advances while narration is paused, synthesizing, or waiting between pages.
- Changing presets replaces the deadline from the new selection time.
- Selecting `Off` removes the countdown and does not stop current narration.
- Expiry disables narration, stops audio, clears pending page transitions, and closes the narration bar.
- Expiry does not disable independent automatic page flipping.
- Manual stop, end of document, errors, PDF changes, and unmount clear scheduled timer work.
- A synthesis result that resolves after expiry cannot start playback.

## Out Of Scope

- Arbitrary user-entered durations.
- Persisting a selected preset or active deadline.
- Pausing the countdown when narration is paused.
- Cancelling an Edge TTS process already running in Electron.
- Stopping page-flip sound effects or the independent automatic page-flip feature.
