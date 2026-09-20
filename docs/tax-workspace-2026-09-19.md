# Fiscal workspace — 19 September 2026

## Reuse before expansion

The current application already contains `tax-cash-basis`, invoice engines,
FatturaPA import/export, country-specific calculators, and accountant exports
(including structured and international variants). Do not replace these with a
second calculator or infer that an export module is a completed delivery service.

This change improves the existing entry paths, not fiscal formulae:

- Visible, named Italy / Switzerland / Spain choices with pressed state.
- A single shared country resolution rule, including legacy archives.
- Italian saved regimes no longer leak into the Swiss or Spanish settings view.
- Switching countries retains the other countries' configuration.
- Spanish activation refreshes settings and hides the previous Italian detail.
- Removed the duplicate invitation for users without invoices or a regime.
- Swiss/Spanish back buttons close their entry screen instead of opening Italy.
- Scoped responsive spacing, touch targets, focus states and reduced-motion support.
- Entry instructions translated into all seven supported UI languages.

No transaction, invoice, attachment, learned parameter, or tax formula is migrated.
Country selection uses the existing saved `taxActiveCountry` preference.

## Coverage boundaries

Italy, Switzerland and Spain have separate existing engines. Their scope differs:
the Swiss accountant report explicitly excludes cantonal/municipal income tax.
The international invoice fallback is not tax calculation for every jurisdiction.
Do not add unsupported countries to the tax chooser merely to claim global coverage.

## Verification

- 220 targeted tests: country precedence, legacy selection, translated entry keys,
  IT/CH/ES engines, cash basis, accountant exports and invoice country profiles.
- Portable production build succeeds; existing large-bundle warnings remain.
- Live Chrome: Vault entry, IT/CH/ES selection, correct simulator opening, back,
  reload persistence; responsive viewport checks at 390 and 768 pixels.
- These are browser viewport checks, not physical iPhone/iPad/Safari certification.

## Remaining work from the requested roadmap

1. Reconcile the existing cash-basis engine with all UI totals, including income
   not matched to an invoice. Do not reintroduce the excluded invoice-only subtotal
   integration documented in `integration-review-2026-09-19.md`.
2. Audit each invoice lifecycle transition against evidence: a generated XML/PDF
   does not establish successful delivery or legal preservation.
3. Connect existing accountant exports to a clear issues/review workflow, retaining
   original documents and traceability; avoid another export implementation.
4. Validate cash scenarios and late-payment estimates against historical outcomes
   before adding confidence labels or training feedback.
5. Test real migration fixtures from other tools for duplicates and totals.
6. Continue the UI review inside invoice creation, eligibility, detailed results
   and accountant export for all supported countries. This change covers entry
   and navigation, not a completed redesign of every internal screen.

Changes are local; no push or deployment is included in this work.
