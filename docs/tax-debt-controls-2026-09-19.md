# Fiscal and debt controls: 19 September 2026

Local extension of the fiscal journey redesign; not pushed or deployed.

- Invoice logo now has an optional identity panel, preview, explicit choose/change
  action, format/size guidance and seven-language feedback. New selection accepts
  PNG/JPEG up to the existing 400 KB limit. Existing saved logos remain untouched.
  Failed reads/decodes retain the previous image. No invoice persistence changes.
- Small back actions in the existing IT/CH/ES fiscal journey use a shared button.
- Debt planner, payment registration, consolidation, offer comparison and fixed
  commitments receive a scoped responsive shell. Selected debt types/strategies
  expose aria-pressed; advanced options expose aria-expanded.
- The planner's Add action is in the modal footer, retaining the existing handler.
- Fiscal and debt checkboxes retain native semantics with custom visual treatment,
  24px check controls and whole-label touch targets. Numeric input dimensions no
  longer accidentally affect fiscal checkboxes. Reduced motion and forced colors
  are handled explicitly.

Validation: 138 targeted tests passed (debt, fixed commitments, fiscal review,
workspace and invoice engines). Final portable build passed. Chrome live checks
at 390px/768px: invoice logo layout, retained draft debt name after changing type,
advanced mortgage options, checking/unchecking variable rate, footer Add reachable,
zero visible debt input/button horizontal overflow at 390px.

The file chooser opened, but the browser tool rejected setFiles (Not allowed).
Actual image selection/decoding remains unverified end to end. No financial test
record was saved. No physical iOS/Android device or complete country-flow audit
was performed. New branding text is localized; legacy invoice labels still need
a broader language review. This is not a claim that every microinteraction has
been redesigned or verified.
