# Fiscal internal screens — 19 September 2026

Extends the uncommitted fiscal workspace changes in this checkout.

## Changes

- Eligibility: six explicit questions, one at a time, with Yes / No / Not sure.
  No unanswered question is interpreted as false. Navigation retains answers;
  an uncertain answer produces a review-needed result, not an eligibility pass.
  Original fiscal questions, sources and exclusion engine remain unchanged.
- Invoice: persistent input labels, small-screen single-column fiscal fields,
  scoped control styling, secondary footer actions disclosed on demand.
  Original input elements/IDs, invoice calculation, download and validation remain.
  Clear the stale validation summary on edit; live field checks still apply and
  XML generation reruns full validation. Removed duplicate create-invoice CTA.
- Shared visual shell applied to existing IT/CH/ES simulator entry/results,
  Swiss invoice entry/results, regime picker and eligibility screens.
- Accountant export: one explained format chooser calling the existing separate
  country export functions. No second export engine or new delivery service.
- Seven-language copy for new review/navigation/export controls. Existing Italian
  normative labels remain Italian; this is not a full translation audit of every
  legacy fiscal string.

## Validation

254 targeted tests pass. Portable production build succeeds (existing large-chunk
warnings remain). `git diff --check` passes.

Live Chrome tests use a separate localhost origin on port 4181, keeping the main
4177 archive separate. Tested onboarding into a forfettario test profile,
unanswered blocking, selected-answer navigation, six-question uncertain result,
invoice incomplete-XML blocking, live invoice preview with a test amount of 1250,
Swiss simulator result and the explained export chooser. No invoice submitted,
no messages sent, no tax records or legal transmissions generated.

Viewport checks at 390 and 768 pixels; measured visible invoice inputs remained
inside the 768-pixel viewport. No physical mobile keyboard, Safari, iOS or Android
certification. The browser controller briefly timed out; the affected checks were
restarted and completed. Production publication and end-to-end real fiscal
submission/conservation are not part of this change.

Remaining: broader visual and language review of secondary guides, payment tools
and legacy tax result copy; physical device checks; actual export downloads across
countries and official delivery workflows. Do not claim every fiscal interaction
or every jurisdiction has been fully certified.
