# Paper Voice

Read and listen to PDF papers. Paper Voice opens a PDF locally, reads it aloud with Speechify Simba 3.5, Google Gemini 3.8 Flash TTS or OpenAI text-to-speech while highlighting the passage being spoken, and offers a reflowed **Reading view** — a single scrolling column in which display equations, figures and tables appear exactly as typeset in the paper rather than as the scrambled text of their text layer.

It runs as a macOS desktop app (Electron, Apple Silicon) and as a web app served by a Cloudflare worker. Both use the same React reader.

**Install on macOS:** download `Paper-Voice-<version>-arm64.dmg` from the [Releases](https://github.com/tingyuansen/pdf-voice/releases) page and follow [INSTALL.md](INSTALL.md).

## What it does

- **Two views of the same document.** *PDF view* shows the pages as printed, scrolling continuously, with fit-width and 50–300 % zoom (buttons, trackpad pinch, or ctrl/⌘ + scroll) and sharp rendering at the display's pixel ratio. *Reading view* reflows the text into one comfortable column (18–40 px) that runs across page boundaries. Itemize and enumerate items are kept whole: a wrapped item is one paragraph, and every marked line starts a new item.
- **Equations, figures and tables as set in the paper.** Reading view detects display equations from their labels and geometry, and figures and tables from their captions, then rasterises those regions from the PDF page and shows them inline at the reading size. Inline sub- and superscripts are rendered as such. Running heads, page numbers and draft line numbers are recognised and dropped.
- **Listen.** Three speech engines, switchable in the sidebar and tried in this order: Speechify `simba-3.5` (the default; twelve US and UK voices, Harper first), Google `gemini-3.8-flash-tts` (eight voices) and OpenAI `gpt-4o-mini-tts` (13 voices). Every other engine with a key backs up the chosen one: a passage that fails is sent to the next, in a voice of the same gender. Playback speed 0.75–2×. Read a selection, the current page, or from the current page to the end; playback buffers roughly 30 seconds ahead (up to six passages), continues across pages, and the passage being read is highlighted in either view. The pause button pauses at any moment — including while a passage is still being prepared, where the clip waits ready and resumes — so a slow first passage or the silence at a page turn no longer risks dropping the reading. Turn **Follow reading** off to scroll freely while listening; it defaults to on and remembers your preference. With a backup configured, the chosen engine gets one attempt with a 12-second whole-download deadline, then hands off immediately on failure. Each backup gets one attempt of at least 20 seconds, longer for long passages; if all fail, playback stops with a retry message. Without a backup, the selected engine retries once with a 12-second deadline per attempt. The macOS app's local server queues Speechify requests under the account's concurrency cap (three on the free plan) instead of failing over. Only the current passage owns an audio player; downloaded clips are cached as blobs so long sessions do not accumulate media decoders. If the playback clock stops for eight seconds, the app recreates the player once and resumes the cached clip at its last position. Persistent stalls produce a retry message, also visible in clean mode. Every clip generated in a session is kept in memory (up to 256 MB, oldest evicted first), so replaying a passage, re-reading an earlier page, or reloading a revised PDF only sends text that has not been spoken yet; nothing is written to disk and the store empties when the app closes. Equations are announced by number rather than read symbol by symbol; figures are skipped and their captions read, and axis ticks, table cells and axis labels left as text are skipped. Every engine receives the same spoken form of a passage: TeX glyphs are read out (`8000 ˚A` as 8000 angstroms, `5–10 M⊙` as 5 to 10 solar masses, `km s−1` as kilometers per second, `≃`, `≲`, `±`, `[Fe/H]`, Greek letters, `Ca ii`), the inline scripts found by the layout analysis decide whether a raised 2 is *squared*, an isotope (`12C`) or a footnote or affiliation marker (not read), and split accents (`f¨ur`) are rejoined.
- **Clean mode** is the default once a document opens: every control hidden except a small floating group — voice, Open PDF, reload, and a light/dark toggle. Dropping a PDF anywhere still opens it; Esc or the restore button brings the full window back. Dark mode inverts the page with hues preserved, so figures keep their colours.
- **Selections snap to sentences.** A drag is cut at the page's own passage boundaries: any sentence it covers by at least half is read verbatim, so overlapping or superset selections reuse the clips already generated, in either view; a short phrase inside a sentence is read as dragged. Selecting while listening leaves playback running and queues the selection for **Read selection**.
- **Reload.** A **Reload** button re-reads the open file from disk and keeps your page, so a re-exported paper is picked up without hunting for it again. The desktop app and Chromium browsers re-read the file through a file handle; other browsers hold only a snapshot and ask you to open the new version instead.
- **Private by construction.** The PDF never leaves the machine; only the passages you play are sent to the selected speech engine. The API key stays on the server side (the Cloudflare worker, or the app's loopback-only local server), never in the browser.

The layout analysis is geometric — column edges from clusters of long lines, the modal line end as the margin, glyph size and baseline offsets for scripts, caption anchors and vertical bands for floats — and is not tuned to any particular paper. It has been checked against two-column astronomy manuscripts (including a numbered draft with full-width captions), a Word-exported proposal with image-only figures, and prose-only documents, where nothing is detected.

## Run the web version

Requires Node 22.13 or newer.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173 and drop a PDF anywhere, or use **Open PDF**. `predev` copies `SPEECHIFY`, `GOOGLE_API_KEY` and `OPENAI` from `~/.env` into the git-ignored `.dev.vars`. An engine without a configured key offers a password field for a session-only key. `npm run build` produces the deployable worker in `dist/`.

## Build the macOS app

```sh
npm run desktop:build      # bundle the reader and PDF.js assets into desktop-dist/
npm run desktop:dev        # …and launch it in Electron
npm run desktop:package    # …and build the DMG into work/mac-release/
```

The app bundles Electron, the built reader, PDF.js worker, CMaps, standard fonts and WebAssembly image decoders, and a small local HTTP server that serves the reader on a loopback port and proxies speech requests. It reads `SPEECHIFY`, `GOOGLE_API_KEY` and `OPENAI` from `~/.env` at request time; documents are opened with Open PDF or by dropping them onto the window. The DMG is ad-hoc signed for local use; Developer ID signing and notarization are not configured.

## Checks

```sh
npm test            # layout, phrase, decimal, speech-text, buffer, selection and playback checks (pure Node)
npm run test:desktop  # local server: assets, key handling, live speech and concurrency
npm run test:ui       # Electron: zoom anchor, current-page start, fallback, free scrolling
npx tsc --noEmit
npm run lint
```

The checks that need a real PDF look for `public/examples/manuscript.pdf` and skip with a note when it is absent; any two-column paper placed there will exercise them, and the equation and figure census in `tests/verify-equations.mjs` is written for the paper it was developed on.

## Layout

```
app/          React reader (page.tsx), continuous PDF surface, styles, worker API route
lib/          reflow.ts (layout analysis), page-crop.ts (equation/figure rasteriser),
              phrase-boundaries.ts, passages.ts, number-runs.ts, furniture.ts (running heads),
              speech-text.ts (what each passage sounds like), speech-buffer.ts, playback.ts
desktop/      Electron main process, local server, packaging config, icon sources
public/       PDF.js worker, CMaps, standard fonts and image decoders served to the reader
scripts/      local key import for the dev worker, CI install helper
tests/        verification scripts run by npm test
work/         (ignored) packaging output, logs and scratch
```

How a page becomes Reading view: text items from PDF.js are grouped into lines by baseline and gap; columns are inferred; numbered equations are anchored by their right-aligned labels and their fraction parts, limits and delimiters absorbed; captions define bands for figures and tables, split at the widest gap when a table sits over a figure; unnumbered equations are then sought outside figures; the remaining lines become paragraphs and headings with hyphenation repaired, and every text item stays mapped to a speech passage so highlights line up in both views.

## License

MIT — see [LICENSE](LICENSE). Speech is generated by the Speechify, Gemini or OpenAI API and billed to your account; see [Speechify pricing](https://speechify.ai/pricing), [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) and [OpenAI pricing](https://developers.openai.com/api/docs/pricing). OpenAI has announced that `gpt-4o-mini-tts` leaves its API on January 6, 2027.
