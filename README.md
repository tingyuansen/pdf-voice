# Paper Voice

Read and listen to PDF papers. Paper Voice opens a PDF locally, reads it aloud with OpenAI text-to-speech while highlighting the passage being spoken, and offers a reflowed **Reading view** — a single scrolling column in which display equations, figures and tables appear exactly as typeset in the paper rather than as the scrambled text of their text layer.

It runs as a macOS desktop app (Electron, Apple Silicon) and as a web app served by a Cloudflare worker. Both use the same React reader.

**Install on macOS:** download `Paper-Voice-<version>-arm64.dmg` from the [Releases](https://github.com/tingyuansen/pdf-voice/releases) page and follow [INSTALL.md](INSTALL.md).

## What it does

- **Two views of the same document.** *PDF view* shows the pages as printed, scrolling continuously, with fit-width and 50–300 % zoom and sharp rendering at the display's pixel ratio. *Reading view* reflows the text into one comfortable column (18–40 px) that runs across page boundaries.
- **Equations, figures and tables as set in the paper.** Reading view detects display equations from their labels and geometry, and figures and tables from their captions, then rasterises those regions from the PDF page and shows them inline at the reading size. Inline sub- and superscripts are rendered as such. Running heads, page numbers and draft line numbers are recognised and dropped.
- **Listen.** OpenAI `gpt-4o-mini-tts` with 13 voices and 0.75–2× speed. Read a selection, the current page, or the whole document; playback buffers ahead, continues across pages, and the passage being read is highlighted in either view. Equations are announced by number rather than read symbol by symbol; figures are skipped and their captions read.
- **Clean mode** hides every control except a small floating play button. Dark mode inverts the page with hues preserved, so figures keep their colours.
- **Private by construction.** The PDF never leaves the machine; only the passages you play are sent to OpenAI. The API key stays on the server side (the Cloudflare worker, or the app's loopback-only local server), never in the browser.

The layout analysis is geometric — column edges from clusters of long lines, the modal line end as the margin, glyph size and baseline offsets for scripts, caption anchors and vertical bands for floats — and is not tuned to any particular paper. It has been checked against two-column astronomy manuscripts (including a numbered draft with full-width captions), a Word-exported proposal with image-only figures, and prose-only documents, where nothing is detected.

## Run the web version

Requires Node 22.13 or newer.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173 and drop a PDF anywhere, or use **Open PDF**. `predev` copies `OPENAI` from `~/.env` into the git-ignored `.dev.vars` so the worker can call OpenAI; without a configured key the app offers a password field for a session-only key. `npm run build` produces the deployable worker in `dist/`.

If `public/examples/manuscript.pdf` exists it is opened automatically as the example; the repository does not ship one.

## Build the macOS app

```sh
npm run desktop:build      # bundle the reader and PDF.js assets into desktop-dist/
npm run desktop:dev        # …and launch it in Electron
npm run desktop:package    # …and build the DMG into work/mac-release/
```

The app bundles Electron, the built reader, PDF.js worker, CMaps and standard fonts, and a small local HTTP server that serves the reader on a loopback port and proxies speech requests. It reads `OPENAI` from `~/.env` at request time and opens `~/manuscript.pdf` when present. The DMG is ad-hoc signed for local use; Developer ID signing and notarization are not configured.

## Checks

```sh
npm test            # layout, phrase, decimal, buffer and playback checks (pure Node)
npm run test:desktop  # packaged local server: assets, key handling, one live speech request
npx tsc --noEmit
npm run lint
```

The checks that need a real PDF look for `public/examples/manuscript.pdf` and skip with a note when it is absent; any two-column paper placed there will exercise them, and the equation and figure census in `tests/verify-equations.mjs` is written for the paper it was developed on.

## Layout

```
app/          React reader (page.tsx), continuous PDF surface, styles, worker API route
lib/          reflow.ts (layout analysis), page-crop.ts (equation/figure rasteriser),
              phrase-boundaries.ts, passages.ts, number-runs.ts, speech-buffer.ts, playback.ts
desktop/      Electron main process, local server, packaging config, icon sources
public/       PDF.js worker, CMaps and standard fonts served to the reader
scripts/      local key import for the dev worker, CI install helper
tests/        verification scripts run by npm test
work/         (ignored) packaging output, logs and scratch
```

How a page becomes Reading view: text items from PDF.js are grouped into lines by baseline and gap; columns are inferred; numbered equations are anchored by their right-aligned labels and their fraction parts, limits and delimiters absorbed; captions define bands for figures and tables, split at the widest gap when a table sits over a figure; unnumbered equations are then sought outside figures; the remaining lines become paragraphs and headings with hyphenation repaired, and every text item stays mapped to a speech passage so highlights line up in both views.

## License

MIT — see [LICENSE](LICENSE). Speech is generated by the OpenAI API and billed to your account; see the [text-to-speech guide](https://developers.openai.com/api/docs/guides/text-to-speech).
