# Flipbook React

React/Vite ebook reader with page flipping, thumbnails, zoom controls, and fullscreen mode.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Replace Pages Later

Export your PDF pages to image files and put them in `public/pages`. Update `src/data/bookPages.ts` so each page points to the correct image and thumbnail path.

Each page entry uses this shape:

```ts
{
  id: 1,
  title: 'Cover',
  image: '/pages/page-1.png',
  thumbnail: '/pages/page-1.png'
}
```
