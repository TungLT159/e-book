export type PdfTextContentItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

export function sanitizeNarrationText(text: string) {
  let sanitized = "";

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

  return sanitized
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function removeLeadingPageNumber(text: string) {
  return text.replace(/^\d+\s+(?=\p{L})/u, "").replace(/^\d+(?=\p{L})/u, "");
}

export function textContentItemsToNarrationText(items: PdfTextContentItem[]) {
  let text = "";

  const appendSpace = () => {
    if (text && !/\s$/.test(text)) {
      text += " ";
    }
  };

  for (const item of items) {
    const itemText = item.str || "";

    text += itemText;

    if (item.hasEOL) {
      appendSpace();
    }
  }

  return removeLeadingPageNumber(sanitizeNarrationText(text));
}

type NarrationAudioChunk = {
  startPage: number;
  endPage: number;
  text: string;
};

const SENTENCE_BOUNDARY_PATTERN = /[.!?](?:["')\]]+)?\s*$/;

function hasParagraphBoundary(text: string) {
  return /\n\s*\n\s*$/.test(text);
}

function hasSentenceBoundary(text: string) {
  return SENTENCE_BOUNDARY_PATTERN.test(text.trimEnd());
}

export function buildNarrationAudioChunks(pageTexts: string[]): NarrationAudioChunk[] {
  if (pageTexts.length === 0) {
    return [];
  }

  const chunks: NarrationAudioChunk[] = [];
  for (let startIndex = 0; startIndex < pageTexts.length; ) {
    const maxEndIndex = Math.min(startIndex + 2, pageTexts.length - 1);
    let chosenEndIndex = maxEndIndex;

    for (let index = maxEndIndex; index >= startIndex; index -= 1) {
      if (hasParagraphBoundary(pageTexts[index] || "")) {
        chosenEndIndex = index;
        break;
      }
    }

    if (chosenEndIndex === maxEndIndex) {
      for (let index = maxEndIndex; index >= startIndex; index -= 1) {
        if (hasSentenceBoundary(pageTexts[index] || "")) {
          chosenEndIndex = index;
          break;
        }
      }
    }

    const chunkPages = pageTexts.slice(startIndex, chosenEndIndex + 1);

    chunks.push({
      startPage: startIndex + 1,
      endPage: chosenEndIndex + 1,
      text: chunkPages.join("\n\n"),
    });

    startIndex = chosenEndIndex + 1;
  }

  return chunks;
}

export function normalizeNarrationAudioData(audioData: unknown) {
  if (audioData instanceof ArrayBuffer) {
    return audioData;
  }

  if (ArrayBuffer.isView(audioData)) {
    const view = audioData as ArrayBufferView;
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
  }

  if (
    audioData &&
    typeof audioData === "object" &&
    "data" in audioData &&
    Array.isArray((audioData as { data?: unknown }).data)
  ) {
    return new Uint8Array((audioData as { data: number[] }).data).buffer;
  }

  if (audioData && typeof audioData === "object") {
    const bytes = Object.entries(audioData)
      .filter(([key, value]) => /^\d+$/.test(key) && typeof value === "number")
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([, value]) => value as number);

    if (bytes.length > 0) {
      return new Uint8Array(bytes).buffer;
    }
  }

  throw new Error("Dữ liệu âm thanh Edge TTS không hợp lệ.");
}
