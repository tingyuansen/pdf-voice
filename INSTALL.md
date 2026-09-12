# Install Paper Voice on macOS

## Requirements

- A Mac with Apple Silicon (M1 or later). This installer does not support Intel Macs.
- An internet connection and a Cartesia and/or OpenAI API key for speech generation.
- No Node.js, Terminal server, or browser setup is needed to run the installed app.

## Install

1. Download `Paper-Voice-1.5.0-arm64.dmg` from the [Releases](https://github.com/tingyuansen/pdf-voice/releases) page and open it.
2. In the installer window, drag **Paper Voice** onto **Applications**.
3. Wait for the copy to finish.
4. Eject the **Paper Voice** disk image in Finder.
5. Open **Applications → Paper Voice**.

Run the copy in Applications, rather than the app inside the disk image. You can keep the DMG as a backup or delete it after installation.

### If macOS blocks the first launch

This personal build is locally signed but has not been notarized by Apple. If macOS blocks it, use **System Settings → Privacy & Security** and look for the message about Paper Voice. If **Open Anyway** is offered, choose it and confirm the launch. Only do this for the installer you built or received from a trusted source. You do not need to disable Gatekeeper or other system-wide protections.

If the message says the app is damaged, try copying a fresh copy from the installer. Do not modify the app bundle after installation.

## Connect speech

On this Mac, Paper Voice automatically reads the `SONIC` entry (a Cartesia API key) and the `OPENAI` entry from `~/.env`:

```dotenv
SONIC=your_cartesia_api_key
OPENAI=your_openai_api_key
```

Either one is enough; choose the engine under **Speech engine** in the sidebar. Cartesia Sonic 3.6 reads more naturally, OpenAI costs about a quarter as much per character. The keys stay on this computer and are used by the app's local server. They are not bundled in the installer. If an engine has no configured key, enter one in the app's password field for the current session. Speech usage is charged to that API account.

## Read a PDF

- Use **Open PDF**, or drag a PDF into the window, to open a document.
- Drag across text, then choose **Read selection** to hear only that part.
- Choose **Read page** to read the displayed page and stop at its end.
- Choose **Read entire document** to start from page 1 and continue through the document.
- Use **Pause / Resume**, the passage controls, voice selection, and playback speed as needed.
- Choose **Dark mode** in the header to darken both the interface and PDF pages.

During playback, the current passage is highlighted. Audio buffers ahead to reduce gaps. Scanned PDFs without selectable text need OCR before they can be read aloud.

## Read comfortably

- Use the sidebar button at the top left to show or hide voice settings.
- **PDF** preserves the original pages and scrolls through all of them. Use − / + to zoom and **Fit width** to reset. Pages re-render sharply for your display.
- **Reading view** reflows the document into a single continuous column, with equations, figures and tables shown as set in the paper. Use **A− / A+** for text sizes from 18 to 40 px.
- Dark mode applies to both views. Text size, reading view, and sidebar preferences are remembered.
- Selection and voice playback work in both views. Figures without a "Figure N" caption still appear as their extracted text; switch to PDF view for those.

## Troubleshooting

**No speech:** Check your internet connection, the API key, and the plan's credits or billing for the selected engine. Cartesia's free plan allows two concurrent requests; the app queues its look-ahead requests to stay within that. The app displays an error if a speech request fails.

**The app closes but remains in the Dock:** This is normal macOS behavior. Choose **Paper Voice → Quit Paper Voice** or press **Command-Q** to quit completely.

**Updating:** Quit Paper Voice, open the new DMG, and drag the new copy into Applications. Choose Replace when Finder asks.

**Uninstalling:** Quit the app and move **Applications → Paper Voice** to the Trash. Your PDFs and `~/.env` remain untouched. Optional app preferences are stored in `~/Library/Application Support/Paper Voice`.

## Build details

Version: 1.5.0 · Architecture: Apple Silicon / arm64

The installer contains the reader and its runtime. It does not contain your API key or any document. Each release is checked for app launch, local signature, installer checksum, and a live speech request through the desktop server.

To build from source, see [README.md](README.md) and run `npm run desktop:package`. Version history is in [CHANGELOG.md](CHANGELOG.md).
