export type BookPage = {
  id: number;
  title: string;
  image: string;
  thumbnail: string;
};

export const bookPages: BookPage[] = [
  { id: 1, title: 'Cover', image: '/pages/page-1.svg', thumbnail: '/pages/page-1.svg' },
  { id: 2, title: 'Activity 1', image: '/pages/page-2.svg', thumbnail: '/pages/page-2.svg' },
  { id: 3, title: 'Activity 2', image: '/pages/page-3.svg', thumbnail: '/pages/page-3.svg' },
  { id: 4, title: 'Activity 3', image: '/pages/page-4.svg', thumbnail: '/pages/page-4.svg' },
  { id: 5, title: 'Activity 4', image: '/pages/page-5.svg', thumbnail: '/pages/page-5.svg' },
  { id: 6, title: 'Back Cover', image: '/pages/page-6.svg', thumbnail: '/pages/page-6.svg' },
];
