# Changelog

Versions of the macOS app. Each entry describes what changed for readers; the README describes how the reader works today.

## 1.5.0 — Cartesia Sonic 3.6, switchable speech engines

A **Speech engine** control in the sidebar chooses between Cartesia Sonic 3.6 (new, read from the `SONIC` key in `~/.env`) and OpenAI gpt-4o-mini-tts (as before, from `OPENAI`). Each engine has its own voice list, served by the app so the sidebar always shows the voices of the engine in use: 14 English voices for Sonic (Sarah, Clive, Zander, Quentin, Rowan, Daniel, Archie, Lauren, Naledi, Julia, Skylar, Gemma, Jacqueline, Jolene) and the 13 OpenAI voices. Sonic reads numbers, decimals and Greek-letter names in scientific prose more faithfully and starts speaking sooner; OpenAI costs about a quarter as much per character. The chosen engine and voice are remembered between sessions, the buffered audio is dropped on a switch so the new voice starts at once, and an engine without a configured key offers the session-only key field. The app's local server queues Sonic look-ahead requests so Cartesia's free-plan limit of two concurrent requests never surfaces as an error.

The app no longer opens `~/manuscript.pdf` on launch or offers an example document; it starts at the drop zone and reads whatever PDF you open or drop onto the window.

## 1.4.0 — figures, tables, continuous PDF pages

Reading view now shows figures and tables as they appear in the paper instead of the tick labels, axis titles and legend text of their text layer. A figure is found from its caption ("Figure 1.", "Fig. 2:", "Table 1"): its body is the band of non-text lines between the caption and the nearest running text, across the caption's column or the whole page for a full-width caption. The band is rasterised from the PDF page and trimmed, so image-only figures with no text layer are covered too, and it is bounded by running heads and page numbers so a figure at the top of a page does not carry the header with it. Figures come before their caption and tables after it; the caption is shown as text in a smaller size. When a float interrupts a paragraph, the paragraph is shown whole first and the float follows at the next paragraph break. A table stacked above a figure is split from it at the widest gap between them. Rotated axis titles, all-caps panel labels, rows of tick labels, and annotations like "R² = 0.98" are recognised as figure content rather than headings, text, or equations. Speech skips figure content; the caption's first passage highlights the whole figure in PDF view while it is read.

Running heads and page numbers — text repeated in the top or bottom row of many pages, or integers there that track the page index — are detected across the document and no longer appear in Reading view; the page marker shows the page number instead. A paragraph cut by a page break continues in the same column, with a line-end hyphen closed up, and any float at the top of the next page follows it.

PDF view now scrolls continuously through every page. Pages are laid out at their final size; those within about a screen of the viewport hold a rendered canvas and text layer and others release theirs, so long documents stay light. The page number follows the scroll while idle, the page controls and arrow keys jump to a page, a text selection belongs to the page it was made on, and document playback moves the highlight down the column page by page.

## 1.3.0 — equations, continuous reading column, colour in dark mode

Reading view now shows display equations as they are typeset in the paper. Numbered displays are found from their right-aligned label; unnumbered ones from short centred lines carrying a relation or operator, set off from the running text. Fraction parts, sum and integral limits, and large delimiters stacked around a display are gathered into the same region, which is rasterised from the PDF page with a transparent background, trimmed, and shown at the reading text size (inverted in dark mode). The voice announces "Equation 5" for a display rather than reading the symbol soup; the PDF-view highlight covers the whole equation while it does. Inline subscripts and superscripts (c<sub>i</sub>, D<sup>g</sup><sub>ij</sub>, 10<sup>−8</sup>) are recognised from glyph size and baseline offset and rendered as such.

Reading view lays every page out in one scrollable column, so a paragraph continues past the page boundary; a thin rule marks each page start. The toolbar page number follows the scroll while idle, the page controls and arrow keys jump to a page, and document playback scrolls through pages as it goes. Pages are laid out in batches as you read; the text was extracted once when the document opened, so paging is instant. The detection is geometric — column edges from the well-supported clusters of long lines, the typical line end as the margin, glyph heights and baselines — and is not tuned to any one paper. Draft line numbers in the margin are recognised and silenced. Inline fractions no longer split a paragraph, and a two-line heading no longer swallows the paragraph after it.

PDF view in dark mode renders the page in full colour and inverts luminance with hue preserved, so figures keep their colours instead of turning grey.

## 1.2.2 — phrase continuity

Close PDF fragments on the same baseline remain connected even when the PDF marks a false line ending. Common abbreviations and initials do not end speech sentences or trigger paragraph breaks by themselves. Long sentences may extend past the usual chunk target; sentences over the 2,400-character cap split at a clause or word boundary. Actual paragraph and page boundaries remain.

## 1.2.1 — decimal handling

Decimal and scientific-number tokens stay together when text wraps. PDF selections use text geometry to join number fragments before speech, avoiding inserted spaces such as `0 . 076`. Spurious end-of-line flags between adjacent decimal fragments are ignored when their positions show they belong on the same line.

## 1.2.0 — clean mode

Choose Clean mode in the header to hide the header, sidebar, reading controls, and playback bar. A small floating play/pause button controls the current voice playback or selection. The adjacent restore button, or Escape, shows all controls again. Left/right arrow keys change pages in clean mode. Clean mode works in both PDF and Reading view, in light and dark themes. Playback continues when entering or leaving clean mode.

## 1.1.1 — reading-view parsing

Paragraphs are reconstructed from line positions, indentation, spacing, and headings; speech chunks no longer create visible paragraph breaks. Adjacent text runs preserve decimal numbers, punctuation, and symbols without inserting spaces. Line-end hyphens are removed only when the combined word occurs elsewhere in the document; ambiguous hyphens are preserved. Every nonempty extractable text item in the 21-page manuscript is covered by a speech/text mapping. Paragraphs crossing a source page boundary still follow page navigation. Equations, figures, and symbols absent from the PDF text layer require PDF view.

## 1.1.0 — reading views

Sidebar toggle, PDF view with fit-width and 50–300 % zoom rendered at the display's pixel ratio, and a first Reading view that reflowed one page at a time with 18–40 px text. Dark mode covered both views.

## 1.0.0 — first macOS build

Electron app with a loopback-only local server: open a PDF, read a selection, a page or the whole document with OpenAI gpt-4o-mini-tts, passage highlighting, two-passage look-ahead buffering, 13 voices and playback speed.
