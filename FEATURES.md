# Development feature status

| Requested area | Implemented behavior / remaining limit |
|---|---|
| Seven-seat SportsBetting table | Relative player/dealer/total/active-panel crops match the untouched reference; automatically placed from the dealer panel; unsupported arrangements are withheld. |
| Blue total verification | Rank sequence must match the displayed total and confidence/confirmation requirements. |
| Orange correction | Matched active seat replaces that seat's hand, never adds a duplicate hand. |
| Fast recognition | Cropped templates/OCR, changed-region caching, two OCR workers, priority processing. Live 1–2 second target not yet demonstrated. |
| Ranks / suits | Reference glyph templates plus rank OCR; exposed suit templates. Untrained or hidden suits remain ?. Broader training needed. |
| Manual correction | Full-hand replacement and manual lock; RC/TC corrected without duplicate count. |
| Strategy / deviations | Existing multi-deck chart extracted into shared production module; H17/S17, surrender, pairs, soft hands and count deviations tested. Single/two-deck recommendations withheld. |
| Other seats | Occupied seats show verified move, total and estimated safe/helpful/bust percentages. |
| Hi-Lo ledger | Running/true count, cards seen, decks remaining, shoe progress, stable identities and corrections. |
| Bet signal | MIN/NORMAL/MORE/HIGH informational pre-hand signal. |
| First-run setup | Rules, seat, profile, source, theme, sounds and recognition settings saved locally. |
| Automatic calibration | Detects dealer strip, total badge and table; fits seven seat regions; tracks window scale/position. No calibration dialog. |
| Live-feed outlines | Teal cards, blue totals, pink splits, amber search limit, red review state; visibility toggle. |
| Drag / resize | Edit directly over live video; drag boxes or eight handles, keyboard nudge, cancel/reset. Scanning pauses while editing. |
| Adaptive hits | Card components grow the crop into nearby space, bounded by occupied neighbors; clipping/overlap withholds changes. |
| Manual split fallback | Two complete hands separated by / replace the original parent; separate correction targets and locks. |
| Automatic next hand | Requires a sustained cleared, visible table followed by a new deal. No round-ID reading. |
| Profiles | Create, save/load, rename, delete; retain rules, selected seat and relative outline adjustments that follow automatic alignment. |
| Pause / resume | Explicit status; stale in-flight work discarded using scan generation. |
| New shoe | Manual reset only. No shuffle OCR or shuffle-area setup. |
| Undo | Most recent confirmed transaction; up to 100 snapshots; scanning pauses on undo. |
| Detection log | Timestamped count/hand/result changes; clear visible log; retain export history. |
| Session dashboard | Confirmed results, hands, wins/losses/pushes/surrenders, win %, high/low TC. |
| Outcome handling | Suggest verified completed-hand result, require confirmation; explicit split hand labels and doubled flag. Two-hand splits track separate cards/totals after a verified pair; atomic migration avoids double counts. More than two stacks require review. |
| Dealer history | Only completed verified dealer hands at round transitions; repeated identical hands can be separate rounds. |
| Shortcuts | Pause, shoe, undo, manual scan, overlay, settings, seats and next hand. |
| Alerts | Optional sound and visual notices. |
| Overlay | Separate always-on-top Electron window. Native behavior awaiting OS tests. |
| Themes / compact | Main window dark/light and compact; unchanged captured feed. Browser layout not rendered in this environment. |
| Status / diagnostics | Capture, OCR, scan state, profile, seat, automatic alignment, runtime and readable failure information. |
| Update checker / About | Read-only GitHub release check and repository/docs/issues links; no overwrite. |
| Export | CSV events and JSON session/ledger/settings/results. |
| Privacy | Local images/OCR; first-time language download and optional GitHub request disclosed. No automatic screenshot storage. |
| Windows / Mac | Original chips, setup and backup launchers preserved; Dev shortcut/application identity; packaging recipes. Native standalone binaries not produced. |
| Documentation | START HERE, README, live checklist, feature list and recorded test outputs. |
| Development safety | Source backup included; uploaded files and remote v1.0.0 release unchanged. |
| Preview | Standalone HTML preview using actual UI and embedded reference; not a native screenshot. |
