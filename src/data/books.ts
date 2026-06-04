import booksJson from '../../data/books.json';

type BookJsonEntry = {
  id: string;
  ten_sach: string;
  so_trang: number;
  duong_dan_file: string;
  thumbnail: string;
  do_tuoi: string;
  chu_de: string;
  tu_khoa: string[];
  is_favorite: boolean;
};

export type BookRecord = {
  id: string;
  title: string;
  pdfPath: string;
  thumbnail: string;
  pageCount: number;
  ageRange: string;
  subject: string;
  keywords: string[];
  favorite: boolean;
  coverColors?: [string, string];
};

export const books: BookRecord[] = (booksJson as BookJsonEntry[]).map((book) => ({
  id: book.id,
  title: book.ten_sach,
  pdfPath: book.duong_dan_file,
  thumbnail: book.thumbnail,
  pageCount: book.so_trang,
  ageRange: book.do_tuoi,
  subject: book.chu_de,
  keywords: book.tu_khoa,
  favorite: book.is_favorite,
}));
