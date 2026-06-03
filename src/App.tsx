import { useState } from "react";
import { BookListPage } from "./components/BookListPage";
import { InteractivePdfFlipbook } from "./components/InteractivePdfFlipbook";
import { pdfBooks } from "./data/pdfBooks";

type View = "home" | "reader";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [activeBookId, setActiveBookId] = useState(
    pdfBooks.length > 0 ? pdfBooks[0].id : "",
  );
  const activeBook = pdfBooks.find((book) => book.id === activeBookId);

  const handleSelectBook = (bookId: string) => {
    setActiveBookId(bookId);
    setView("reader");
  };

  const handleBackToLibrary = () => {
    setView("home");
  };

  if (view === "home") {
    return (
      <main className="app-shell">
        <BookListPage books={pdfBooks} onSelectBook={handleSelectBook} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      {activeBook ? (
        <InteractivePdfFlipbook
          title={activeBook.title}
          pdfPath={activeBook.pdfPath}
          audioPath={activeBook.audioPath}
          timeline={activeBook.timeline}
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
