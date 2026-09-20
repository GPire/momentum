// Closed vocabulary only: never pass report IDs, amounts, names or error text.
export const TRIP_TELEMETRY_EVENTS = Object.freeze([
  'trips_opened', 'trip_detail_opened',
  'trip_route_personal', 'trip_route_company', 'trip_route_companion', 'trip_route_finance',
  'trip_validation_blocked', 'trip_export_opened', 'trip_export_blocked', 'trip_export_download_requested',
  'trip_review_opened', 'trip_credit_linked', 'trip_credit_unlinked',
  'trip_company_submit_started', 'trip_company_submit_received', 'trip_company_submit_failed',
  'trip_company_status_loaded', 'trip_company_status_failed',
]);
