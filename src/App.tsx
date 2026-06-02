import { FlipbookViewer } from './components/FlipbookViewer';
import { bookPages } from './data/bookPages';

export default function App() {
  return (
    <main className="app-shell">
      <header className="hero">
        <p className="hero__eyebrow">React Flipbook</p>
        <h1>Interactive ebook reader</h1>
        <p>
          Flip pages, zoom, jump from thumbnails, and switch to fullscreen. Replace the placeholder pages with images exported from your PDF later.
        </p>
      </header>
      <FlipbookViewer pages={bookPages} />
    </main>
  );
}
