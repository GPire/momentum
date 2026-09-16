# Voice reliability and trip receipts — 2026-09-13

Merged origin/main through a38f1cb without conflicts, retaining the local split repayment/cash scenarios change. Incoming partita IVA discovery and mesh pairing work is preserved.

## Changes

- Voice uses the exported window orchestrator reference, with the existing Vault fallback. A successful direct insertion refreshes the dashboard and active analysis.
- Pending recognition starts are guarded; callbacks from a replaced recognizer cannot modify the new session. Dutch has its own speech locale.
- An exact, unique spoken category name can resolve a renamed/custom category. Normalization handles accents and whitespace. A named category is not overwritten by the classifier. This is not general semantic understanding or new model training.
- Voice calendar actions use the main module's exposed bridge instead of referencing its private binding.
- Trip expense rows expose a localized Open attachment action. Local raster receipts and PDFs have a constrained dialog viewer and a 44px close control; closing restores focus to the originating expense. Data URL format is checked before opening.
- No storage schema, transaction history, model weights, bank provider or external data transmission changes.

## Verification

- Full serial runner: **335/335 test files passed**.
- Production portable build passed; existing chunk-size warnings remain.
- Five voice regression tests cover rapid start, stale session callbacks, Dutch locale, category matching and a final speech result saving a 15 EUR expense and refreshing the list.
- Isolated synthetic trip with a string transaction ID: opened attachment in the in-app browser and Chrome. In-app close restored focus to Open attachment. No real user archive was modified.
- Reproduce receipt QA after building: `node scripts/trip-receipt-preview.mjs`, open localhost:4184 and select the synthetic trip button. The fixture resets its own origin on reload and blocks external connections.

## Remaining work

Actual microphone recognition on iOS/Safari and Android is not certified by these tests. PDF rendering on physical iOS devices remains unverified. The trip page has not been fully redesigned for SMEs in this change.

Voice still needs a dedicated review of batched final results, inferred-amount confirmation, classifier feedback quality and multilingual semantic coverage. Do not describe this as a new trained model or complete voice reliability across all devices.
