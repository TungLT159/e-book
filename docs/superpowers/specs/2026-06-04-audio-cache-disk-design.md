# Audio Cache on Disk Design

## Goal

Generate persistent Edge TTS audio files on disk for the reader, chunked by paragraph-aware groups covering up to three pages, so previously synthesized narration can be reused when the same book, voice, and speech settings are opened again.

## Current Context

`InteractivePdfFlipbook` currently extracts page text, writes a debug text file, and synthesizes narration on demand through the Electron Edge TTS bridge. The implementation already normalizes narration text, validates extracted-text file access, and keeps narration playback logic in the renderer while synthesis happens through Electron.

This change shifts the persisted artifact from debug text to audio cache files. The text pipeline still exists as input preparation, but the durable asset becomes the rendered audio file that can be replayed on later opens.

## Chunking Strategy

Text should be grouped into audio chunks that are as natural as possible while still bounded to at most three pages.

- Prefer paragraph boundaries and sentence boundaries when building a chunk.
- Never exceed three pages in one chunk.
- Preserve page order.
- If a paragraph spans multiple pages, keep it with the chunk that contains the majority of its text rather than splitting arbitrarily.

The chunking goal is to reduce awkward cuts in Vietnamese speech without producing very long audio files.

## Cache Identity

Audio cache files must be stable and deterministic for a given narration configuration.

Cache identity should include:

- the resolved PDF source path,
- the reader title or book identifier,
- the selected Edge TTS voice,
- the speech rate,
- the chunk index,
- the chunk text hash or equivalent content fingerprint.

Including the chunk text fingerprint ensures stale audio is invalidated when the extracted text changes even if the book path and settings stay the same.

## File Layout

Store audio cache under the Electron `userData` directory in a dedicated narration cache folder.

Recommended structure:

- `userData/narration-audio/<book-key>/<voice>/<rate>/<chunk-key>.mp3`

The book key should be derived from the resolved PDF path and title using a filesystem-safe encoding. The chunk key should incorporate the chunk index and chunk fingerprint.

## Cache Retention

Audio cache files are persistent on disk but should be pruned by time.

- Keep cache entries while they are still recent enough to be useful for reopen/replay.
- Remove stale cache entries when they exceed the configured retention window.
- Pruning should run opportunistically during narration startup or cache lookup so it does not require a separate maintenance job.

The retention window should be a fixed, documented duration in code and should be long enough to cover normal reopen sessions while still preventing indefinite cache growth.

## Runtime Flow

When narration starts:

1. Build the chunk list from extracted page text.
2. For the current chunk, check whether the cache file exists, is valid, and is not expired.
3. If the file exists, play it immediately.
4. If the file is missing, invalid, or expired, call Edge TTS in the Electron main process, write the MP3 file to disk, then play it.
5. Advance through chunks sequentially until narration completes or the user stops playback.

The renderer should continue to control playback state and chunk advancement, while the Electron main process owns synthesis, disk writes, and cache pruning.

## Invalidation and Reuse

Cache reuse is allowed only when all identity inputs match and the chunk fingerprint matches.

Invalidate and rebuild cache when any of these change:

- PDF source path,
- title/book identifier,
- voice,
- speech rate,
- extracted text content for the chunk.

This keeps later opens fast while preventing stale audio from being played against a modified source.

## Error Handling

- If synthesis fails for a missing or expired cache file, narration stops and surfaces the original Edge TTS error.
- If an existing cache file is corrupt or unreadable, delete it and synthesize again once.
- If repeated synthesis fails, narration stops and shows the failure message.
- If the cache directory cannot be created or written, narration stops and reports the filesystem error.

## Testing

Tests should verify:

- The first play of a chunk synthesizes and writes a persistent MP3 file.
- The second play of the same chunk uses the cached MP3 instead of synthesizing again.
- Chunking never exceeds three pages.
- Paragraph and sentence boundaries are preferred when chunking.
- Changing voice or speech rate creates a different cache key.
- Changing the source text invalidates the cached MP3.
- Corrupt cache files are rejected and rebuilt.
- Expired cache files are pruned and re-synthesized.

## Out Of Scope

This change does not replace the existing extracted-text debug file pipeline, does not change the renderer UI beyond playback behavior, and does not add network storage or cloud synchronization.
