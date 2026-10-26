# VEXORA Studio

**An original, lightweight, offline-first vector design editor.** VEXORA has its own project structure, vector document model, UI, and editing code.

> **Current stage:** early working prototype (0.1.0). The project includes a usable vector-editing foundation and twelve small/partial intelligent-design feature areas. It is not yet a replacement for Adobe Illustrator, Affinity Designer, or CorelDRAW. See [FEATURE_STATUS.md](docs/FEATURE_STATUS.md) for the exact feature limits.

## Features in this build

- SVG-based canvas and vector document model.
- Selection and multi-selection, move, basic transforms through the inspector, object ordering, and deletion.
- Rectangle, ellipse, line, freehand path, and text tools. Resize handles are available; direct point editing works for freehand paths created in VEXORA.
- Fill, stroke, stroke width, opacity, text size/family/weight, rotation and position fields.
- Layers, visibility and layer locking.
- Zoom, pan, grid and optional snapping.
- Undo/redo, per-session named snapshots, autosaved recovery copy.
- Save/open `.vex` project JSON; import simple SVG; export SVG and PNG. A starter example is included in `samples/starter-layout.json`.
- Batch export of scaled artwork variants.
- Offline rule-based design assistant, starter layout, geometric alignment, duplicate/tiny-object cleanup, brand palette checks, contrast analysis, basic preflight, simple dieline generation, and extrusion-style preview.
- Basic Unicode text storage/rendering; actual Sinhala glyph shaping depends on the installed browser/system fonts.
- No paid API, account, local AI model, or network service is required for normal web-mode usage.

For short Sinhala setup steps, see [START-HERE-SI.md](START-HERE-SI.md).

## Run on Linux (4GB RAM friendly)

### Option A — easiest: run the local web app

1. Extract the ZIP.
2. Open a terminal in the extracted `vexora-studio` directory.
3. Run:

   ```bash
   chmod +x run-linux.sh
   ./run-linux.sh
   ```

4. It opens `http://127.0.0.1:4173/` in your default browser. If it does not, open that address manually.
5. Stop the local server with `Ctrl+C`.

This needs Python 3 and a reasonably modern browser. It serves files only from your own machine and binds to `127.0.0.1`; it does not contact a remote service. Do **not** open `web/index.html` directly as a `file://` URL because browser module security can block imports.

Alternative command:

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory web
```

### Option B — build a Linux desktop package (optional)

The source includes a Tauri 2 desktop wrapper. Building it needs Rust, Cargo, Tauri CLI v2, a C toolchain, WebKitGTK 4.1, and the GTK/AppIndicator development libraries appropriate for your Linux distribution. A 4GB machine may need a swap file and a single compiler job.

1. Install Rust using the official instructions at <https://rustup.rs/>.
2. Install the Linux prerequisites listed in the Tauri v2 prerequisites guide: <https://v2.tauri.app/start/prerequisites/>.
3. Install Tauri CLI v2:

   ```bash
   cargo install tauri-cli --version '^2.0'
   ```

4. In the project folder, reduce build parallelism to avoid running out of RAM:

   ```bash
   CARGO_BUILD_JOBS=1 ./build-desktop-linux.sh
   ```

5. Check `src-tauri/target/release/bundle/` for whatever packages the host successfully builds. This build has **not** been verified in this artifact environment; package availability depends on your Linux system and installed dependencies.

The web version is the simplest way to try the current editor on a 4GB computer. Building the Tauri desktop app can use extra RAM, disk space, and compile time.

## Tests and code checks

The project uses Node's built-in test runner and has no JavaScript npm dependencies:

```bash
npm test
npm run check
```

Expected test result for the current source: **10 tests passing**. These tests validate the document model and several feature algorithms; they are not a substitute for full interactive GUI tests.

## Working with files

- **Save** downloads a `.vex` file containing the editable document data.
- **Open** is available from the File menu and accepts `.vex`, JSON, or SVG files.
- **Export → SVG** creates editable SVG markup.
- **Export → PNG** rasterizes the artwork at the selected scale.
- The browser may ask for a download location depending on your browser settings.
- A recovery copy is stored in local browser storage for up to seven days. It is not a portable backup. Use Save to download a project file.

## Repository structure

```text
vexora-studio/
├── web/                    # Offline editor UI and application logic
│   ├── index.html
│   ├── styles.css
│   └── js/                  # document model, renderer, import/export and features
├── src-tauri/               # Optional Tauri desktop wrapper source
├── samples/starter-layout.json
├── tests/core.test.js
├── docs/FEATURE_STATUS.md
├── docs/PUBLISHING.md
├── START-HERE-SI.md
├── run-linux.sh
├── build-desktop-linux.sh
├── package.json
├── .github/workflows/ci.yml
└── LICENSE
```

## Independence and legal notes

- The source is written for this project and does not import another vector editor's codebase.
- The Tauri wrapper declares its runtime dependencies in `src-tauri/Cargo.toml`. A Rust build could not be run in this environment because Cargo is unavailable; the first desktop build will resolve dependencies and create `Cargo.lock`, which should be committed before publishing a release. The current browser app itself has no external runtime package dependency.
- Do not use third-party icons, fonts, templates, mockups, or models unless their licences permit your intended use.
- The project has no embedded AI model. The Smart Studio command helper is a small, transparent rules-based assistant. Optional online/local AI provider integration remains future work and should be separately licensed/configured.
- The code uses an SVG document representation; import of complicated SVGs with nested transforms, filters, masks, clipping, gradients, raster images, or embedded fonts is incomplete and may lose features. Keep a copy of originals.
- PDF/CMYK/separation/overprint prepress output is not implemented. The preflight report is advisory only.

## Security and privacy

Normal editing does not upload documents. Files are imported locally and exports are generated in the client. The project has no analytics or telemetry. Treat untrusted input files cautiously, especially very large SVGs; import only artwork you trust while this prototype matures.

## Git repository

The source bundle is prepared for a clean, independent Git repository. Follow `docs/PUBLISHING.md` to create an empty remote repository under your own account and push the code. No public remote repository is claimed to exist until you publish it and verify the URL.

## License

MIT. Read [LICENSE](LICENSE).

### Branding assets
- `web/assets/vexora-logo-original.jpg` — original VEXORA logo supplied by the owner; used in the app title bar and favicon.
- `web/assets/grafio-logo-original.png` — original Grafio logo supplied by the owner; displayed in Help → About VEXORA Studio.
- These source image files are included as provided and are not redrawn.
