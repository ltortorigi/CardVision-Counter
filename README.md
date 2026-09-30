# CardVision Counter — 2.1.0-dev.3

This update adds draggable live-feed outlines, adaptive hit searches, and separate tracking of two split hands to automatic alignment for the supplied **seven-seat SportsBetting table**. It is based on the previous CardVision development build and preserves the strategy, verified card ledger, corrections, launchers, icons, profiles, overlay and session tools. No GitHub release was changed.

## Open and connect

Extract the complete ZIP into a new folder. Windows: run `Windows/1 - SETUP CARDVISION.bat`, then use the black/gold **CardVision Counter Dev** desktop shortcut. Mac: run `Mac/1 - SETUP CARDVISION.command`, then open the black/silver `Mac/CardVision Counter.app`. Backup launchers are included. Setup requires Node.js 20+ and npm and downloads the locked dependencies with `npm ci`. First OCR startup downloads English language data. The Mac wrapper is a source launcher, not a signed standalone application.

Save your deck/rule/seat preferences. Select the actual SportsBetting browser window and click **Connect**. Scanning starts automatically when video is ready. Wait for **TABLE: AUTO-ALIGNED**. You do not have to draw rectangles, confirm calibration, enter a round number, or configure a shuffle region. **Find table again** retries automatic discovery.

## Drag the outlines on the live feed

**Show scan outlines** is enabled by default. Once TABLE: AUTO-ALIGNED appears, click **Edit outlines**. The video keeps playing and recognition pauses. Drag inside a rectangle to move it; drag the white corner/edge handles to resize it. Choose a small total badge or active-seat box using the outline menu. Arrow keys move the selected rectangle one captured pixel; Shift moves ten. **Done editing** saves and restores the previous scan state. **Cancel edits** restores the prior settings. **Reset selected** / **Reset all** restore automatic placement.

Teal outlines show card crops, blue outlines show totals/seat labels, and pink outlines show separated split hands and their totals. The dashed amber outline shows the selected player's additional search limit. These are the latest scan's regions over the live feed. Red outlines indicate clipping or overlapping ownership requiring review. Changing the feed panel size or display scaling preserves coordinate alignment, including letterboxing. Editing is local to the feed; it never drags cards or clicks the casino.

Adjustments are stored per profile as offsets from automatic placement. They follow the table when its position/scale changes. **Find table again** preserves the offsets; use Reset selected/all to remove them. No round or shuffle crop is needed.

## Hits and split hands

The initial player outline is a starting area. Each scan checks a nearby area for white card components and grows the effective crop to contain an extending stack. Search is bounded toward neighboring occupied seats. If cards touch the search boundary or occupied scan regions overlap, the old count is retained and the hand stays under review. Move or enlarge the affected outline on the feed; keep adjacent seats separate. Enlarging a crop cannot read ranks hidden by other cards.

Two separated stacks can become **Split 1 (left)** and **Split 2 (right)** only after an already verified pair, two readable cards in each stack, each stack's own matching total, and the configured repeated confirmations. The original pair is removed from the parent hand and moved into the two child hands atomically, so it is not counted again. Subsequent hits update the appropriate child. Both hands appear separately in Table Hands. The Selected Seat selector switches between them; result review uses the selected split result label.

Split-total boxes start beneath each detected stack. If a badge is elsewhere, click Edit outlines, select its pink **split total** box, and drag it onto that badge. Split card boxes follow the detected stacks; adjust their parent seat outline to change the search area. A missing badge, clipping, one disappearing stack, unclear ownership, or more than two stacks keeps the count under review rather than merging totals. Split-ace and resplit strategy require checking the table rules.

If scanning started after the split or automatic reads cannot verify both hands, select the player seat in **Manual Correction** and enter both complete hands separated by `/`, for example `8 3 / 8 K`. This also replaces the original pair and locks the two hands. Each child then appears as a separate correction target. Unlock each child to permit automatic updates. Automatic resplits to three/four hands are not supported in this build.

These paths have automated logic, pointer-handler and constructed-image checks. **Live split footage, actual browser pointer delivery, and Windows/macOS capture still require device testing.**

## How automatic alignment works

The app searches the captured pixels for the dealer panel's slate label strip, adjacent pale total badge, and blue table area. It checks the supported seven-seat arrangement, then derives scaled card, total, dealer and active-seat regions from that visible anchor. Two consistent observations are required before alignment is accepted. It recalculates the geometry when the window changes size or position. Card size is based on the detected panel, rather than the entire monitor's width/height.

Card components within the seat regions establish occupancy. Empty seats do not go through rank OCR. The selected player, dealer, other occupied seats, active-seat correction panel and hand totals are then read with the existing template/OCR system. A transparent outline layer marks the scan areas over the unchanged captured video.

This is a layout-specific visual detector, **not recognition of every casino or arbitrary table design**. The supplied alternative four-seat arrangement is rejected by the layout check. Multiple visible copies, missing dealer panel, severe occlusion, unfamiliar colors or poor resolution may remain at TABLE: FINDING. The app withholds screen-based recommendations while the table is not locked, rather than trusting old rectangles. Select only the casino window and keep it visible. You still choose which numbered seat is yours; the app cannot infer your identity.

## Hands without a round ID

There is no round-ID OCR or shuffle-banner OCR in this version. A visible, recognized table must have no face-up card groups in the dealer/player regions for at least **three observations and 1.5 seconds**. When cards return, a new hand begins once; the shoe count is retained. Brief empty animations and missing/occluded capture do not establish a clear table. This is a conservative visual heuristic and still needs live-session testing.

**Next hand** remains a manual fallback if scanning was paused or a clear-table interval was missed. Use it only after old cards are removed. **New shoe** is a separate manual action for an actual new shoe; the app does not assume a shuffle because a hand ended. Reset and Undo remain reversible transactions.

## Verification, correction and counting

Player ranks must match the displayed total and pass the configured confidence/multiple-frame checks before entering the count. The matching enlarged active-seat hand can correct that same player; it is never counted as another hand. Unknown/hidden suits remain `?`. Template/OCR scores are match-quality scores, not calibrated probabilities of correctness. Suit coverage is limited to supplied examples; unseen ranks, scaling, fonts and animation still require live testing.

Hi-Lo is unchanged: 2–6 +1; 7–9 0; 10/J/Q/K/A −1. The ledger tracks each physical position within a hand and replaces corrections rather than appending duplicate ranks. True count is RC divided by estimated remaining decks: configured decks minus observed cards/52, floored at 0.25 decks. The app does not know hidden/burned/missed cards or the earlier shoe if you join late.

Manual Correction accepts the complete hand in deal order, for example `A♣ Q♦ 3♣`. Replace hand adjusts its current-hand count contribution and enables a manual lock; Unlock screen reads allows automatic changes again. An empty manual replacement removes that hand's entries after confirmation. Undo pauses scanning and restores the last confirmed transaction; 100 snapshots are retained.

## Strategy and session tools

The existing multi-deck DAS/dealer-peek strategy and count deviations remain, including H17/S17 and late-surrender settings, corrected soft-hand surrender behavior, and pair/deviation precedence. One-/two-deck counting works, but their recommendations are withheld because separate strategy charts are not included. Count-adjusted actions show the basic action they replace. MIN/NORMAL/MORE/HIGH are informational pre-hand count signals. The app never places bets or clicks game controls.

Safe draw estimates cover totals at most 21; bust risk covers totals over 21; they sum to 100%. Helpful is a subset of safe draws that increases the total to 17–21. Estimates use only the configured shoe and observed inventory.

Review outcome suggests a result only for a verified, complete dealer/player hand; Confirm result records it. WIN/LOSS/PUSH/SURRENDER, split result labels and doubled flags are supported. Two-hand split tracking and independent totals are supported as described above; unclear layouts and resplits beyond two hands require review. Win % = wins/(wins+losses), excluding pushes/surrenders. Hands played counts confirmed outcomes. Dealer history stores previously verified completed dealer hands at hand transitions.

Profiles save rules, seat, source preference, confidence settings, sounds, theme, compact mode, outline visibility and relative region adjustments. Old absolute calibration rectangles are not imported; new feed edits use relative offsets. Session data stays in memory until exported. CSV exports events; JSON also includes ledger/settings/results. Clearing the log only clears its display.

The separate desktop overlay stays on top and shows selected hand, dealer, move, RC, TC and bet level. Optional sounds accompany visual alerts. Space: pause/resume; N: new shoe; Ctrl/Cmd Z: undo; S: scan; O: overlay; comma: settings; 1–7: seat; R: fallback next hand. Shortcuts are inactive while typing or a dialog is open.

## Troubleshooting

- **TABLE: FINDING:** select the actual casino browser window, not CardVision or a screen containing multiple copies. Keep the dealer label/total panel and table visible. Click Find table again. A blocked/unsupported table will stay unverified.
- **Boxes need adjustment:** wait for automatic alignment, then click Edit outlines and drag the affected crop/total directly on the live feed. Done editing saves it; Reset selected restores its automatic placement. Confirm the version says 2.1.0-dev.3. Do not launch the previous copy by mistake.
- **Capture error:** check the selected window and OS screen-recording permission. On Mac, the permission may belong to Terminal/Electron when using the source launcher; restart after granting it. Minimized/protected windows may not capture.
- **Recognition error:** first startup needs internet for language data. Restart after resolving access/cache problems. Manual correction remains available. Diagnostics identifies capture vs OCR vs table-alignment state.
- **VERIFYING persists:** the table may be aligned but ranks or the blue total are still unreadable. Increase browser zoom/resolution, keep the table visible and allow it to settle. Alignment does not guarantee card accuracy. Use a complete manual correction if necessary.
- **Missed next hand:** if scanning did not see the sustained clear table, pause and use Next hand after old cards disappear. Shoe count stays. Do not use New shoe between normal hands.
- **Launcher fails:** rerun setup, use the extracted project folder and backup launcher, and open a fresh terminal after installing Node. Keep all folders together. macOS may require right-click → Open for the unsigned wrapper or execute permission on command files; do not disable system security globally.

## Privacy, updates and packaging

Screen images and cropped OCR stay on the computer. Screenshots are not uploaded or saved automatically. Setup downloads dependencies, OCR downloads English data once, and Check for Updates contacts GitHub Releases for `ltortorigi/CardVision-Counter`. Project/docs/issues buttons open that repository. No self-overwrite or repository/release write is performed.

From App: `npm ci`, `npm start`, `npm test`. Optional image tests need `@napi-rs/canvas` in Node's module path or `CARDVISION_CANVAS_MODULE`: `npm run test:vision`, `npm run test:auto`, `npm run test:adaptive` and `npm run test:editor`. The renderer smoke test uses DOM stubs and is not a browser layout test.

Build on the target OS with `npm run dist:win`, `npm run dist:win:portable`, or `npm run dist:mac`. Developer build launchers, source backup, OS icons and output folder are included. **No EXE/DMG, signing/notarization or native Windows/macOS capture test was produced here.** The 1–2 second live target remains unproven.

The HTML interface preview uses the actual interface against an embedded training/reference screenshot with OCR fallback disabled. It is not a native runtime screenshot. See Developer/TEST RESULTS.md and LIVE TEST CHECKLIST.md for verification and limitations.
