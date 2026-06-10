import { useState } from "react";
import { BookListPage } from "./components/BookListPage";
import { InteractivePdfFlipbook } from "./components/InteractivePdfFlipbook";
import { books } from "./data/books";
import { usePdfBookLoader } from "./hooks/usePdfBookLoader";
import { useReadingProgress } from "./hooks/useReadingProgress";

type View = "home" | "reader";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [activeBookId, setActiveBookId] = useState(
    books.length > 0 ? books[0].id : "",
  );
  const { books: loadedBooks, loading } = usePdfBookLoader(books);
  const { isLoaded, progressByBookId, getBookProgress, saveBookProgress } = useReadingProgress();
  const activeBook = loadedBooks.find((book) => book.config.id === activeBookId)?.config;

  const handleSelectBook = (bookId: string) => {
    setActiveBookId(bookId);
    setView("reader");
  };

  const handleBackToLibrary = () => {
    setView("home");
  };

  if (view === "home") {
    return (
      <div className="app-shell">
        <BookListPage
          books={loadedBooks}
          loading={loading}
          onSelectBook={handleSelectBook}
          progressByBookId={progressByBookId}
        />
      </div>
    );
  }

  return (
    <main className="app-shell">
      {activeBook ? (
        <InteractivePdfFlipbook
          title={activeBook.title}
          pdfPath={activeBook.pdfPath}
          bookId={activeBook.id}
          savedProgress={getBookProgress(activeBook.id)}
          isReadingProgressLoaded={isLoaded}
          onProgressChange={saveBookProgress}
          onBackToLibrary={handleBackToLibrary}
        />
      ) : (
        <p className="loading-msg loading-msg--error">
          No static PDF book is configured.
        </p>
      )}
    </main>
  );
}
