import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeFileSegment(value) {
  return String(value || 'book')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'book';
}

export function formatExtractedTextDebug({ title = '', pdfPath = '', pages = [] } = {}) {
  const lines = [
    `Title: ${title}`,
    `PDF: ${pdfPath}`,
    `Pages: ${pages.length}`,
    '',
  ];

  pages.forEach((text, index) => {
    lines.push(`--- Page ${index + 1} ---`);
    lines.push(String(text || '').trim());
    lines.push('');
  });

  return lines.join('\n');
}

export async function writeExtractedTextDebug(userDataPath, payload = {}) {
  const outputDir = path.join(userDataPath, 'extracted-text');
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${safeFileSegment(payload.title)}-${timestamp}.txt`;
  const outputPath = path.join(outputDir, fileName);

  await writeFile(outputPath, formatExtractedTextDebug(payload), 'utf8');
  return outputPath;
}

function hasStableIdentity(stats) {
  return (typeof stats?.dev === 'bigint' || typeof stats?.dev === 'number')
    && (typeof stats?.ino === 'bigint' || typeof stats?.ino === 'number');
}

function isSameRegularFile(stats, validatedFile) {
  return stats.isFile()
    && hasStableIdentity(stats)
    && stats.dev === validatedFile.dev
    && stats.ino === validatedFile.ino;
}

async function openValidatedExtractedTextFile(validatedFile, flags) {
  const fileHandle = await open(validatedFile.filePath, flags | (constants.O_NOFOLLOW || 0));

  try {
    const openedStats = await fileHandle.stat({ bigint: true });
    if (!isSameRegularFile(openedStats, validatedFile)) {
      throw new Error('Invalid extracted text file');
    }
    return fileHandle;
  } catch (error) {
    await fileHandle.close();
    throw error;
  }
}

export async function readExtractedTextPage(validatedFile, pageNumber) {
  const fileHandle = await openValidatedExtractedTextFile(validatedFile, constants.O_RDONLY);
  let fileText;
  try {
    fileText = await fileHandle.readFile('utf8');
  } finally {
    await fileHandle.close();
  }
  const marker = `--- Page ${pageNumber} ---`;
  const startIndex = fileText.indexOf(marker);

  if (startIndex === -1) {
    return '';
  }

  const contentStart = startIndex + marker.length;
  const nextMarkerIndex = fileText.indexOf('--- Page ', contentStart);
  const contentEnd = nextMarkerIndex === -1 ? fileText.length : nextMarkerIndex;

  return fileText.slice(contentStart, contentEnd).replace(/\s+/g, ' ').trim();
}

export async function validateExtractedTextFile(userDataPath, filePath) {
  const extractedTextDir = path.resolve(userDataPath, 'extracted-text');
  const resolvedFilePath = path.resolve(filePath || '.');

  if (!filePath || path.dirname(resolvedFilePath) !== extractedTextDir) {
    throw new Error('Invalid extracted text file');
  }

  try {
    const fileStats = await lstat(resolvedFilePath, { bigint: true });
    const [canonicalDir, canonicalFilePath] = await Promise.all([
      realpath(extractedTextDir),
      realpath(resolvedFilePath),
    ]);

    if (fileStats.isSymbolicLink()
      || !fileStats.isFile()
      || !hasStableIdentity(fileStats)
      || path.dirname(canonicalFilePath) !== canonicalDir) {
      throw new Error('Invalid extracted text file');
    }

    return { filePath: canonicalFilePath, dev: fileStats.dev, ino: fileStats.ino };
  } catch {
    throw new Error('Invalid extracted text file');
  }
}

export async function emptyExtractedTextFile(validatedFile) {
  const fileHandle = await openValidatedExtractedTextFile(validatedFile, constants.O_WRONLY);
  try {
    await fileHandle.truncate(0);
  } finally {
    await fileHandle.close();
  }
}
