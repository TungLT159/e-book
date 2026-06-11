# Custom Select Design

## Goal

Replace every native select currently visible in the application with one reusable `CustomSelect` that matches the existing doodle visual language. This includes the three library filters in `BookListPage` and the narration voice selector in `InteractivePdfFlipbookMenu`.

The replacement must preserve the current filtering and narration behavior while improving visual consistency, keyboard operation, and responsive behavior. Search within the option list is outside this scope.

## Chosen Direction

Use a custom popover listbox with the approved "Doodle popover" treatment:

- A closed trigger uses dark `#111827` text, a clearly visible dark border, and the existing offset shadow. Closed or inactive selectors must not be faded.
- Hover, keyboard focus, and open states add the primary blue accent without reducing the contrast of neighboring selectors.
- The chevron indicates whether the menu is open.
- The popover uses a dark doodle border, offset shadow, and the application's surface color.
- Unselected options retain dark, legible text. The selected option uses a light blue background, darker blue text, and a check mark.
- Disabled state is visibly distinct but remains readable.

## Component API

Create a shared `CustomSelect` component with a minimal controlled API:

```ts
type CustomSelectOption = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  label: string;
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};
```

`label` supplies the accessible name and visible field label. `value` and `onChange` keep state ownership in the existing parent components. `placeholder` is used only when no option matches the current value. The component does not own application filtering or narration state.

## Structure And Behavior

The component consists of a labelled trigger button and a conditionally rendered listbox popover.

- Clicking the trigger opens or closes the listbox.
- Clicking an option calls `onChange`, updates focus consistently, and closes the listbox.
- Clicking outside closes the listbox without changing the value.
- `Escape` closes the listbox and returns focus to the trigger.
- `ArrowDown` and `ArrowUp` open the listbox when needed and move the active option.
- `Home` and `End` move to the first and last option.
- `Enter` or `Space` selects the active option.
- Opening the list initially activates the selected option, or the first option when the current value has no match.
- A disabled select cannot open and exposes its disabled state to assistive technology.

The trigger uses `aria-haspopup="listbox"`, `aria-expanded`, and `aria-controls`. The menu uses `role="listbox"`; each item uses `role="option"` and `aria-selected`. Option identifiers connect the active item through `aria-activedescendant` when the listbox owns focus.

Only one interaction model will be used throughout the component. Tests will assert the final focus model rather than mixing native-select and custom-listbox expectations.

## Integration

### Library Filters

Replace the three native selects in `BookListPage` with `CustomSelect` instances:

- Subject includes an empty-value option labelled `Tất cả chủ đề`.
- Age range includes an empty-value option labelled `Tất cả độ tuổi`.
- Keyword includes an empty-value option labelled `Tất cả từ khóa`.

Existing state setters and option generation remain unchanged. The surrounding three-column filter layout also remains unchanged, collapsing according to the existing responsive rules.

### Narration Voice

Replace the voice select in `InteractivePdfFlipbookMenu` with `CustomSelect`. Map the existing `voiceOptions` directly to the shared option shape and retain the current `selectedVoice`, `setSelectedVoice`, and disabled condition.

The listbox must layer above the TTS submenu and remain within the viewport. A long voice list receives a maximum height and vertical scrolling.

## Styling And Responsive Rules

Add component-level BEM classes to `App.css` using existing color, spacing, radius, border, and shadow variables wherever they match the approved mockup.

- The trigger fills its container and has a minimum height consistent with current controls.
- Text truncates safely instead of widening the filter grid or TTS submenu.
- The popover is positioned relative to the field, matches at least the trigger width, and has a constrained viewport-aware maximum width.
- Long menus use vertical scrolling.
- On narrow screens, the menu remains inside the viewport and does not create horizontal page scrolling.
- Reduced-motion preferences disable nonessential transitions.
- Focus remains clearly visible through the application's blue focus treatment.

## Error And Edge Cases

- An empty option list renders a disabled trigger and cannot open a menu.
- A value absent from the options displays `placeholder` when provided, otherwise an empty string; it does not silently alter parent state.
- Option values are expected to be unique within one select.
- Updating options while open recalculates the active option without selecting a new value automatically.
- Unmounting the component removes document-level outside-click listeners.

## Testing

Add focused component tests for:

- Rendering the current label and selected option.
- Opening and selecting with the pointer.
- Keyboard navigation and selection with arrows, `Home`, `End`, `Enter`, and `Space`.
- Closing with `Escape` and an outside click.
- Disabled and empty-option behavior.
- Correct ARIA roles and selected state.

Update integration tests for `BookListPage` to select filter options through the custom listbox instead of `userEvent.selectOptions`. Verify the same strict and related-result behavior as before.

Add or update `InteractivePdfFlipbookMenu` coverage to verify that selecting a voice sends the chosen value to `setSelectedVoice` and that loading or an empty voice list disables the control.

Run the complete Vitest suite and production build after implementation.

## Out Of Scope

- Searching or filtering within an open option list.
- Multi-select behavior.
- Virtualizing options.
- Changing filter matching, ranking, narration loading, or speech behavior.
- Replacing non-select controls such as the speech-rate range input.
