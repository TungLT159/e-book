import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const EDGE_TTS_MODULE = 'edge_tts';
const PYTHON_COMMAND = process.env.EDGE_TTS_PYTHON || process.env.PYTHON || 'python';

const LIST_VOICES_SCRIPT = `
import asyncio
import json
import edge_tts

voices = asyncio.run(edge_tts.list_voices())
print(json.dumps(voices, ensure_ascii=False))
`.trim();

const SYNTHESIZE_SCRIPT = `
import asyncio
import edge_tts
import sys

text = sys.stdin.read()
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
    const nextCode = text.charCodeAt(index + 1);

    if (code >= 0xd800 && code <= 0xdbff) {
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        sanitized += text[index] + text[index + 1];
        index += 1;
      }
      continue;
    }

    if (code >= 0xdc00 && code <= 0xdfff) {
      continue;
    }

    sanitized += text[index];
  }

  return sanitized.replace(/\s+/g, ' ').trim();
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
  return JSON.parse(stdout);
}

export async function synthesizeEdgeTts(
  text,
  { voice = '', rate = '', pitch = '', volume = '' } = {},
) {
  const safeText = sanitizeEdgeTtsInput(text);

  if (!safeText) {
    return new Uint8Array();
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'flipbook-edge-tts-'));
  const outputPath = join(tempDir, `${randomUUID()}.mp3`);

  try {
    await runPythonScript(SYNTHESIZE_SCRIPT, {
      args: [outputPath, voice, rate, pitch, volume],
      input: safeText,
    });

    const audio = await readFile(outputPath);
    return new Uint8Array(audio);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
