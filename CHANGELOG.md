# Changelog

All notable changes to this project are documented in this file.

## [v0.5.2] - 2025-08-29

Summary
- Patch release containing UX/validation improvements, normalization of names, reporting enhancements and PWA performance tweaks.

Added / Changed
- Enhanced transaction editing and reporting features: stronger validation for income/expense types, more descriptive transaction listing, and a reusable `ChartLegend` component for consistent legends across reports.
- Admin taxonomy and Reports improvements: mobile-friendly, scrollable legends with amounts; consolidated selection behavior and recursion fixes in chart legends.
- Trim/dedupe behavior in dropdowns and UI: dropdown inputs now trim and dedupe entries; createSource/createTarget no longer run early during form edits — new entities are created only when a transaction is saved.
- Backend normalization: category/source/target names are normalized (trimmed and matched case-insensitively) to prevent trailing-space duplicates; controllers now use LOWER(TRIM) lookups.

Fixed
- Increase mobile padding for prefixed inputs (2.5rem) to avoid layout issues on small screens.
- Validation treats whitespace-only input as empty; submitted fields are sanitized to reduce accidental duplicates or invalid data.

Performance
- PWA/perf tweaks to reduce first-swipe jank on mobile:
  - `content-visibility: auto`, `contain: layout` and intrinsic-size hints for cards.
  - `scrollbar-gutter: stable both-edges` to avoid reflow on scrollbars.
  - Temporary `will-change`/translate3d warm-up on swipe containers and lazy preload of swipe engine code.


## [v0.5.1] - 2025-08-28

Summary
- Includes a realtime transaction search feature (with accent/umlaut support), mobile UI fixes for prefixed inputs, PWA performance tweaks, and several UX/validation improvements.

Added
- Realtime transaction search (debounced, accent-insensitive filtering across columns).
- `frontend/public/icons/search.svg` and updated i18n strings.
- `frontend/src/components/ChartLegend.jsx` (reusable chart legend component).

Fixed
- Increase mobile padding for prefixed inputs to 2.5rem (hotfix).
- Trim and dedupe dropdown entries; prevent creation of duplicate sources/targets on early save.
- Validation: treat whitespace-only fields as empty; sanitize submitted fields.

Performance
- Smooth first swipes on mobile without visual changes:
  - cards: `content-visibility: auto`, `contain: layout`, and intrinsic-size hints (mobile 260px, desktop 320px).
  - `scrollbar-gutter: stable both-edges` to prevent reflow.
  - Swipe warm-up: temporary `will-change`/translate3d on swipe containers for 1s.
  - Lazy preload of swipe engine chunk shortly after mount on mobile.

UX / Optimizations
- Enhanced transaction editing and reporting features:
  - EditTransaction: stronger validation rules for income/expense types.
  - Reports: added ChartLegend and refined chart layouts for better mobile display.
  - Transactions: show more descriptive info (category names, uncategorized labels).
  - UserManagement, App styles, and CustomSwitch: spacing and responsiveness improvements.
  - Modern scrollbar styling for scrollable panels.

Data / Backend
- Normalize names for category/source/target: trim and case-insensitive matching to prevent trailing-space duplicates. Backend lookups now use LOWER(TRIM).


## [v0.5.0]

(previous)





