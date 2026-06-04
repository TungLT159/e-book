# File-Backed Edge TTS Design

## Goal

Make the formatted extracted-text file the required source for Edge TTS narration. After narration finishes the final page, clear the in-memory extracted text and empty the generated text file. Starting narration again must extract the PDF and create a fresh formatted text file automatically.

## Current Context

`InteractivePdfFlipbook` extracts each PDF page into `pageNarrationTexts`, writes those pages to a debug text file when narration starts, and can read a page block from that file before calling Edge TTS. It currently retains the in-memory text and generated file contents after narration finishes, and it can fall back to in-memory text if the file is unavailable.

The Electron debug-text bridge formats pages as `--- Page N ---` blocks and exposes a page-block reader. The bridge needs one additional operation to empty an existing generated text file.

## Narration Source

The generated `.txt` file is the required narration source. Before synthesizing the current page, the reader waits for the formatted file to be created, reads the matching `--- Page N ---` block, sanitizes it, and sends that text to Edge TTS.

The reader must not fall back to `pageNarrationTexts` for synthesis. If file creation or page-block reading fails, narration stops and displays an error. Keeping a single required source ensures the spoken content always matches the formatted file.

## Narration Lifecycle

When the user starts automatic narration:

- If in-memory page text is available, write it to a new formatted text file.
- If in-memory page text was previously cleared, extract all PDF pages again and update the in-memory page text first.
- Wait until the formatted text file is ready before reading and synthesizing the current page.

When a page finishes playing, advance to the next page and repeat the file-backed read and synthesis flow. Empty page blocks are skipped by advancing as though playback completed.

When the final page finishes playing:

- Disable automatic narration.
- Clear `pageNarrationTexts` in React state.
- Empty the generated `.txt` file through the Electron bridge.
- Clear the reader's reference to that generated file so it cannot be reused accidentally.

Stopping narration before the final page does not clear memory or empty the file. Cleanup is specifically tied to successful completion of the final page.

## Electron Bridge

Add a debug-text operation that receives the generated file path and overwrites it with an empty UTF-8 string. Expose it through the existing Electron IPC/preload bridge alongside `writeExtractedText` and `readExtractedTextPage`.

The operation only acts on the generated file path held by the reader. Failures during final cleanup should be reported without attempting to delete the file.

## Error Handling

- Failure to extract PDF text, create the formatted file, read the current page block, or synthesize/play audio stops narration and shows an actionable error.
- Failure to empty the file after the final page leaves narration disabled and reports the cleanup error.
- No synthesis fallback reads from React state.

## Testing

Tests should verify:

- Edge TTS receives text read from the generated file, not the in-memory page text.
- Narration waits for file creation before reading the page block.
- Completing a non-final page flips to and narrates the next page.
- Completing the final page disables narration, clears in-memory page text, empties the generated file, and clears its reference.
- Stopping before the final page does not empty the file.
- Starting narration after final cleanup re-extracts the PDF, creates a fresh file, and narrates from it.
- Missing or unreadable file-backed page text stops narration instead of falling back to memory.

## Out Of Scope

This change does not add manual text-file selection, delete generated files, alter text extraction or formatting rules, or change Edge TTS voice and speed controls.
