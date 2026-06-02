# Flipbook React Design

## Goal

Create a new React project directly in `E:\gitlab\e-book` that provides a FlipHTML5-like ebook reading experience. The first version will use local placeholder page images, while keeping the content structure easy to replace later with pages exported from a PDF.

## Scope

The app will include:

- Page flip reading experience.
- Previous and next navigation controls.
- Thumbnail navigation for jumping to a page.
- Zoom in, zoom out, and reset zoom controls.
- Fullscreen mode for the reader.
- Responsive layout for desktop and mobile.
- A simple page configuration file that can be updated when real PDF-derived page images are available.

The app will not include direct PDF parsing in the first version. Future PDF support can be added by exporting PDF pages to images and updating the page configuration.

## Architecture

Use React with Vite for a lightweight single-page app. Use `react-pageflip` for the page-turning effect instead of building the page physics manually.

Main units:

- `App`: page shell and composition root.
- `FlipbookViewer`: owns flipbook state, current page, zoom, fullscreen trigger, and integration with `react-pageflip`.
- `Toolbar`: stateless controls for navigation, zoom, fullscreen, and page status.
- `ThumbnailStrip`: renders page thumbnails and calls back when the user selects a page.
- `bookPages`: static page metadata with image and thumbnail paths.

Assets will live under `public/pages`. The initial implementation will include generated placeholder SVG pages so the app works without the final PDF.

## Data Flow

`bookPages` provides ordered page metadata. `FlipbookViewer` passes the current page index and event handlers to `Toolbar` and `ThumbnailStrip`. Navigation actions update the flipbook through the `react-pageflip` instance and synchronize local React state when page flips complete.

Zoom will be stored as a numeric scale, bounded to a reasonable range to prevent unusable layouts. Fullscreen will use the browser Fullscreen API on the reader container.

## User Experience

Desktop layout will prioritize a large centered book, with thumbnails available beside or below the reader depending on screen width. Mobile layout will stack controls, book, and thumbnails to avoid horizontal overflow.

Controls should remain clear and direct:

- Previous / next page.
- Current page indicator.
- Zoom out / reset / zoom in.
- Fullscreen.
- Thumbnail click to jump to a specific page.

## Error Handling

If an image fails to load, the page should still reserve space and show a readable fallback message. Fullscreen errors should fail silently from the user's perspective, leaving the reader usable in normal mode.

## Verification

After implementation:

- Install dependencies with `npm install`.
- Run `npm run build` to verify the production build.
- Optionally run `npm run dev` for manual visual review.

## Future Extension

When the PDF is available, export its pages to image files and place them in `public/pages`. Then update `bookPages` to point at the new images and thumbnails. Direct browser-side PDF rendering is intentionally out of scope for the first version to keep the app simple and reliable.
