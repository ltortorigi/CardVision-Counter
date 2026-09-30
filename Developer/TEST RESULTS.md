# Test results — 2.1.0-dev.3

Executed in the Linux development container on 2026-09-30.

| Check | Result | Scope |
|---|---|---|
| Core, state, region and split tests | 61 passed, 0 failed | Actual production modules. Includes the previous 45 checks plus split migration/updates/deduplication, independent totals, missing/clipped/overlapping stacks, manual split, locks, undo, reset, inventory, coordinate transforms and saved offsets. |
| Reference raster/count integration | Passed | Production raster/template/vision on actual-table.png: six cards, RC −2; selected A Q 3 / 14, Q 9 / 19, dealer 8; active duplicate excluded; blank frame rejected. |
| Automatic alignment fixtures | 8 checks passed | Original; scaled/translated captures; dealer and seats 2/5 in the supplied resized screenshot; blank rejection; unsupported four-seat rejection; auto-alignment/count integration. |
| Adaptive hit/split pixel tests | Passed | Real raster detects a constructed stack growing beyond its initial outline, flags clipped edges/overlapping occupied crops, retains table lock for two split stacks, recognizes two copied Q/9 stacks and independent 19 totals, moves a verified pair into four cards without duplication, and applies independent split-total offsets. |
| Feed editor handlers/rendering | Passed | Production pointer handlers move/resize boxes, cancel an interrupted drag, nudge by keyboard and reject edits in view mode; letterboxed coordinates and 2x device pixels checked. Production drawing generates Live-Feed-Outlines.png. Uses a simulated event surface, not real browser event delivery. |
| Renderer integration | Passed | Actual renderer against DOM stubs: initialization, element IDs, settings, selected move, JSON export, undo; native canvas scans an initially uncalibrated reference to six cards/RC −2. Editing, applying, cancelling and automatic realignment preserve count and saved offsets. |
| JavaScript syntax | Passed | Changed production modules, renderer, Electron main/preload and generated preview scripts parse. |
| Browser / native desktop | Not run | No actual browser layout/pointer event delivery, Electron IPC, Windows/macOS capture, installer or live-table validation. No EXE/DMG or signing/notarization produced. |
| Live split coverage | Not run | Constructed split images reuse reference pixels. They do not establish recognition accuracy on an unseen live split layout. |
| Live speed / general accuracy | Not run | 1–2 second target remains unproven; fixture timings are not live latency. |

The actual-table image is a template training/reference fixture. Successful reads are regression checks, not independent recognition benchmarks. Image tests disable OCR fallback to isolate production segmentation/template/ledger behavior. The new adaptive split fixture constructs two Q/9 stacks and total badges from the supplied image; it is explicitly synthetic. Native pointer delivery, touch capture behavior, and browser CSS layout still need device verification.

The app supports two split hands after a verified pair and each child's independent verified total. More than two stacks, unclear ownership, clipped cards and missing split totals retain the old count and withhold recommendations. Starting mid-split can be corrected manually with two complete hands separated by `/`. See the live checklist for acceptance testing.

Raw results: core-test-results.txt, fixture-test-results.json, autocalibrate-test-results.json, adaptive-test-results.txt, editor-test-results.txt, renderer-test-results.txt.

Run `npm test` in App for the 61 Node tests. Optional image/editor tests require @napi-rs/canvas available to Node or the CARDVISION_CANVAS_MODULE environment variable: `npm run test:vision`, `npm run test:auto`, `npm run test:adaptive`, `npm run test:editor`. `npm run test:renderer` uses DOM stubs; setting CARDVISION_CANVAS_MODULE adds real image/scan/edit integration.

The standalone HTML preview runs the real interface against the embedded reference image with live capture and OCR fallback disabled. Live-Feed-Outlines.png is the production canvas overlay rendered onto the reference image, not a native app screenshot.
