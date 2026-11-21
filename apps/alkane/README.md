# Alkane inside Folio

Alkane is integrated as a standalone, same-origin web app under `/apps/alkane/` and launched from Folio's Apps view.

- Its compressed source archive is stored as numbered Base64 pieces in `source-parts/`; the build helper reconstructs and Brotli-decompresses it during the build.
- The original React/Vite editor and diagramming features remain separate from Folio's Next.js component tree.
- The editor runs in an iframe, keeping Alkane's CSS and runtime isolated from Folio.
- Alkane keeps its own IndexedDB database (`alkane-workspace`); it does not share or overwrite Folio workspace records.
- The light theme palette is aligned with Folio's warm canvas, neutral surfaces, and sage-green accent. Alkane's built-in dark theme remains available.

Run the full Folio build with `npm run build`. This builds Alkane first, then runs the Next.js production build. The Alkane build requires npm registry access to install its locked dependencies.
