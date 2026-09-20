# Workspace hierarchy — 19 September 2026

Local UI work, not published. Builds on the fiscal/debt controls changes.

- Shared orbit treatment for payroll/tax entry icons and project task entrances.
- Shorter payroll, debt, bank fee and split descriptions in seven languages.
- Net-worth subtitle now includes recorded liabilities, as the existing engine does.
- Sector comparison and official economic news use named expandable sections,
  retaining their original data containers and rendering/fetch paths. No ranking,
  calculation, market source or financial records changed.
- Payroll/payout modal headers use the existing planet with restrained animated
  orbit, two-column payout choices, readable fields and explicit feedback.
- Responsive asset search and touch targets; reduced-motion/focus support.

Validation: 34 targeted payout, net-worth, sector-rotation and workspace tests
passed; portable production build passed. Browser at 390px: Vault entry view,
salary modal, missing salary fields blocked, payout IBAN choice and missing-value
error. Sector disclosure opens and retains all ten populated historical rows.
No records saved. Viewport restored after checks.

Remaining: broader nested journeys for goals, travel, split, tax and investments;
physical-device keyboard testing; richer validation of asset result states. This
change does not claim new predictive model capability or full redesign coverage.
