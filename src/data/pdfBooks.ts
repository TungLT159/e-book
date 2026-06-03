export type PdfBookConfig = {
  id: string;
  title: string;
  pdfPath: string;
  audioPath: string;
  timeline: AudioTimelineItem[];
  coverColors?: [string, string];
};

export type AudioTimelineItem = {
  // Page numbers are one-based so the timeline matches how readers see the book.
  page: number;
  start: number;
  end: number;
};

export const pdfBooks: PdfBookConfig[] = [
  // {
  //   id: "demo",
  //   title: "Ngủ ngon nhé bé cún",
  //   pdfPath: "/books/ngungonnhebecun13715_1312202316.pdf",
  //   audioPath: "/books/ngungonnhebecun13715_1312202316.mp3",
  //   timeline: [
  //     { page: 1, start: 0, end: 8 },
  //     { page: 2, start: 8, end: 16 },
  //     { page: 3, start: 16, end: 24 },
  //   ],
  // },
  {
    id: "soc-khong-he-tham-lam",
    title: "Sóc không hề tham lam",
    pdfPath: "/books/book.pdf",
    audioPath: "/books/sockhonghethamlam827b1_1312202316.mp3",
    timeline: [
      { page: 1, start: 0, end: 8 },
      { page: 2, start: 8, end: 16 },
      { page: 3, start: 16, end: 24 },
      { page: 4, start: 24, end: 32 },
      { page: 5, start: 32, end: 40 },
      { page: 6, start: 40, end: 48 },
      { page: 7, start: 48, end: 56 },
      { page: 8, start: 56, end: 64 },
    ],
    coverColors: ["#e8825c", "#c94b4b"],
  },
];
