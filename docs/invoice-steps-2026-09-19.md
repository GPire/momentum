# Invoice and debt internal journeys

Local changes, not pushed. The existing Italian/general invoice form now uses
three stages: invoice content, issuer identity, review/export. Original DOM nodes,
IDs, listeners, invoice engines and save/export handlers are retained. Navigation
does not save or discard the draft. New step labels have seven-language copy.

XML missing-field validation explicitly requests the appropriate stage before its
existing delayed focus. This was necessary: the first browser test exposed a
hidden-field focus failure. After the correction, browser verification showed
stage 2 active, inv-piva focused and visible at 390px. Content/amount remain intact
on back navigation. A 1250 test amount produced the existing 1252 total with stamp.

Debt entry is a separate expandable area, initially open for an empty archive and
closed after adding. Its footer action follows its open state. Switching strategy
now updates aria-pressed as well as visual classes. Browser checks confirmed the
unsaved name survives collapsing/reopening and Add becomes hidden while closed.

86 invoice/country/debt engine tests passed. Final portable build and diff check
passed. No invoice or debt was saved in browser testing; no document sent.

This stepper is not installed into the separate Swiss invoice form or Spanish
simulator. Their internal journeys, legacy invoice translations, actual exports,
physical-device keyboards and further validation paths still need work. Do not
describe this change as completion of every jurisdiction or nested modal.

## Entry refinement

Compact stage navigation, three essential fields in one panel, sentence assistance
on demand, email/recurrence/fiscal details grouped separately. Original nodes and
listeners retained. Successful parsing closes the helper and focuses the filled
client for review; reduced motion respected. Fiscal validation reveals nested
option disclosures. New essential labels are translated in seven languages.

Browser at 390px: `a Rossi Srl 500 per consulenza` fills Rossi Srl / 500 /
consulenza, closes the helper and returns to the original fields. XML validation
still runs. 162 targeted tax/invoice tests passed. No invoice saved.
