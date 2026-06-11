import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

export const EDGE_TTS_MODULE = 'edge_tts';
export const AUDIO_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_VIETNAMESE_VOICE = 'vi-VN-HoaiMyNeural';
const PYTHON_COMMAND = process.env.EDGE_TTS_PYTHON || process.env.PYTHON || 'python';
const MAX_SYNTHESIS_ATTEMPTS = 6;

const LIST_VOICES_SCRIPT = `
import asyncio
import json
import edge_tts

voices = asyncio.run(edge_tts.list_voices())
print(json.dumps(voices, ensure_ascii=False))
`.trim();

export const SYNTHESIZE_SCRIPT = `
import asyncio
import edge_tts
import sys

text = sys.stdin.buffer.read().decode('utf-8', 'ignore')
text = text.encode('utf-8', 'ignore').decode('utf-8', 'ignore')
output_path = sys.argv[1]
voice = sys.argv[2]
rate = sys.argv[3]
pitch = sys.argv[4]
volume = sys.argv[5]

options = {}
if voice:
    options['voice'] = voice
if rate:
    options['rate'] = rate
if pitch:
    options['pitch'] = pitch
if volume:
    options['volume'] = volume

asyncio.run(edge_tts.Communicate(text, **options).save(output_path))
`.trim();

export function sanitizeEdgeTtsInput(text) {
  let sanitized = '';

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);

    // Skip invalid low surrogate (lone low surrogate without preceding high surrogate)
    if (code >= 0xdc00 && code <= 0xdfff) {
      continue;
    }

    // Handle high surrogate
    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = text.charCodeAt(index + 1);
      // Keep valid surrogate pairs
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        sanitized += text[index] + text[index + 1];
        index += 1;
        continue;
      }
      // Skip invalid high surrogate (not followed by low surrogate)
      continue;
    }

    // Skip control characters except newline/tab/space
    if ((code >= 0x0000 && code <= 0x001F && code !== 0x0009 && code !== 0x000A && code !== 0x000D) ||
        (code >= 0x007F && code <= 0x009F)) {
      continue;
    }

    sanitized += text[index];
  }

  const result = sanitized
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return result;
}

function sanitizePathSegment(segment) {
  return String(segment)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+$/, '_')
    .replace(/^_+|_+$/g, '');
}

function fingerprintChunkText(chunkText) {
  return createHash('sha256').update(String(chunkText), 'utf8').digest('hex').slice(0, 32);
}

function buildAudioCacheResult(audioPath, cacheHit) {
  return {
    audioPath,
    audioUrl: pathToFileURL(audioPath).href,
    cacheHit,
  };
}

function buildEdgeTtsCachePath({ userDataPath, bookKey, voice, rate, volume, chunkIndex, chunkText }) {
  const safeRate = rate ? sanitizePathSegment(rate) : '__default__';
  const safeVolume = volume ? sanitizePathSegment(volume) : '__default__';
  const chunkKey = `chunk-${chunkIndex}-${fingerprintChunkText(chunkText)}`;

  return join(
    userDataPath,
    'narration-audio',
    sanitizePathSegment(bookKey),
    sanitizePathSegment(voice),
    safeRate || '__default__',
    safeVolume || '__default__',
    `${sanitizePathSegment(chunkKey)}.mp3`,
  );
}

function buildLegacyEdgeTtsCachePath({ userDataPath, bookKey, voice, rate, chunkIndex, chunkText }) {
  const safeRate = rate ? sanitizePathSegment(rate) : '__default__';
  const chunkKey = `chunk-${chunkIndex}-${fingerprintChunkText(chunkText)}`;

  return join(
    userDataPath,
    'narration-audio',
    sanitizePathSegment(bookKey),
    sanitizePathSegment(voice),
    safeRate || '__default__',
    `${sanitizePathSegment(chunkKey)}.mp3`,
  );
}

export async function getOrCreateEdgeTtsAudioCacheFile({
  userDataPath,
  bookKey,
  voice,
  rate,
  volume,
  chunkIndex,
  chunkText,
  lookup,
}) {
  const audioPath = buildEdgeTtsCachePath({ userDataPath, bookKey, voice, rate, volume, chunkIndex, chunkText });
  const result = await lookup({ audioPath, ttlMs: AUDIO_CACHE_TTL_MS });

  if (result?.cacheHit) {
    return buildAudioCacheResult(result.audioPath || audioPath, true);
  }

  if (!volume) {
    const legacyAudioPath = buildLegacyEdgeTtsCachePath({
      userDataPath,
      bookKey,
      voice,
      rate,
      chunkIndex,
      chunkText,
    });
    const legacyResult = await lookup({ audioPath: legacyAudioPath, ttlMs: AUDIO_CACHE_TTL_MS });

    if (legacyResult?.cacheHit) {
      return buildAudioCacheResult(legacyResult.audioPath || legacyAudioPath, true);
    }
  }

  return buildAudioCacheResult(audioPath, false);
}

export async function prepareEdgeTtsAudioCacheFile({
  userDataPath,
  bookKey,
  voice,
  rate,
  volume,
  chunkIndex,
  chunkText,
  lookup,
}) {
  const cacheResult = await getOrCreateEdgeTtsAudioCacheFile({
    userDataPath,
    bookKey,
    voice,
    rate,
    volume,
    chunkIndex,
    chunkText,
    lookup,
  });

  if (cacheResult.cacheHit) {
    return cacheResult;
  }

  const audio = await synthesizeEdgeTts(chunkText, { voice, rate, volume });
  if (audio.length === 0) {
    return cacheResult;
  }

  await mkdir(dirname(cacheResult.audioPath), { recursive: true });
  const tempPath = `${cacheResult.audioPath}.${randomUUID()}.tmp`;

  try {
    await writeFile(tempPath, audio);
    await rename(tempPath, cacheResult.audioPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }

  return cacheResult;
}

function runPythonScript(script, { args = [], input = '' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_COMMAND, ['-c', script, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          stderr.trim() || `Python edge-tts exited with code ${code ?? 'unknown'}`,
        ),
      );
    });

    if (input) {
      child.stdin?.write(input);
    }

    child.stdin?.end();
  });
}

export async function getEdgeTtsVoices() {
  const { stdout } = await runPythonScript(LIST_VOICES_SCRIPT);
  return JSON.parse(stdout).filter(
    (voice) => voice?.Locale === 'vi-VN' || voice?.ShortName?.startsWith('vi-VN-'),
  );
}

export async function synthesizeEdgeTts(
  text,
  { voice = '', rate = '', pitch = '', volume = '' } = {},
) {
  const safeText = sanitizeEdgeTtsInput(text);
  const safeVoice = voice.startsWith('vi-VN-') ? voice : DEFAULT_VIETNAMESE_VOICE;

  if (!safeText) {
    return new Uint8Array();
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'flipbook-edge-tts-'));
  const outputPath = join(tempDir, `${randomUUID()}.mp3`);

  try {
    let lastError;

    for (let attempt = 1; attempt <= MAX_SYNTHESIS_ATTEMPTS; attempt += 1) {
      try {
        await runPythonScript(SYNTHESIZE_SCRIPT, {
          args: [outputPath, safeVoice, rate, pitch, volume],
          input: safeText,
        });

        const audio = await readFile(outputPath);
        if (audio.length > 0) {
          return new Uint8Array(audio);
        }

        lastError = new Error('Python edge-tts produced an empty audio file.');
      } catch (error) {
        lastError = error;

        if (!String(error instanceof Error ? error.message : error).includes('NoAudioReceived')) {
          throw error;
        }
      }
    }

    throw lastError || new Error('Python edge-tts failed to synthesize audio.');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
