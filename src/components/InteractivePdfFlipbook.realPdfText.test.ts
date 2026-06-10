/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  textContentItemsToNarrationText,
  type PdfTextContentItem,
} from "../utils/narration";

describe("real PDF narration text extraction", () => {
  it("keeps Vietnamese words joined on the squirrel book page 3", async () => {
    const pdfData = new Uint8Array(
      await readFile("public/books/sockhonghethamlam827b1_1312202316.pdf"),
    );
    const pdf = await getDocument({ data: pdfData }).promise;
    const page = await pdf.getPage(3);
    const textContent = await page.getTextContent();

    expect(textContentItemsToNarrationText(textContent.items as PdfTextContentItem[])).toBe(
      "Khi trời mưa, sóc lấy một ít hạt dẻ và hạt phỉ để cất vào một cái hố. Sau đó, cậu ăn những thứ khác.",
    );
  });
});
