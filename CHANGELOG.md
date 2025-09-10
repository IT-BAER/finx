# Changelog

All notable changes to this project are documented in this file.

## [v0.6.1] - 2025-09-10

### feat
- **PWA**: User-controlled update flow - service workers wait for explicit user confirmation instead of auto-updating
- **PWA**: Added 30-minute snooze for "Not now" option with localStorage persistence
- **UI**: Version badge component with GitHub link in footer
- **UI**: Dropdown components now show max 6 entries with smooth scrolling

### fix
- **PWA**: Removed forced reload after 5 seconds when dismissing update prompt
- **Charts**: Improved label alignment under bars in "Source Spending by Category" chart
- **Migration**: Fixed income source cleanup migration (007) logic to prevent failures

### chore
- Updated version numbers to 0.6.1 across package.json files

## [v0.6.0] - 2025-09-09

Summary
- Major release aggregating all changes since v0.5.2 (includes v0.5.3–v0.5.5), with unified charts/layouts, improved filtering & sharing, PWA updates, and various fixes.

Highlights
- UI & Charts:
  - Unified Reports with Dashboard visuals: removed “Income vs Expenses” on Reports, placed “Source Category Breakdown” next to “Expenses by Category” on desktop, moved “Balance Trend” below; unified card heights (md:h-[370px]).
  - Dashboard: “Balance Trend” full-width on desktop (lg:col-span-2) with unified height.
  - New reusable components: PerSourceExpensesTrend, PerSourceBalanceTrend, DailyExpensesChart, SummaryCards, ChartLegend.
  - Chart improvements: theme-aware legends, improved color palettes and borders, percentage data labels, and dark-mode label color fixes.
- Filtering & Sharing:
  - Source filter dropdowns added to Dashboard and Reports (icon-only trigger).
  - Persist selected sources per user and per page via localStorage.
  - Enhanced shared source display names (e.g., “Source (Owner)”); getUserSources returns owned and shared sources respecting permissions/filters; improved filtering consistency and summary calculations.
- PWA:
  - Service worker registers only in production (fixes dev MIME errors) while preserving update notifications with skip-waiting modal.
- Data & Backend:
  - Name normalization across category/source/target (trim, case-insensitive) and controller lookups with LOWER(TRIM).
  - Sharing controller includes owner info in source queries; strengthened validation and ownership checks.
  - Optimized income transaction handling with automatic migration.
  - Utilities for income source cleanup to migrate misclassified income sources to targets.
- Fixes:
  - Filter icon vertical alignment with titles; typography leading consistency.
  - Source filtering edge cases; corrected filtered summary and daily-expense calculations.
  - Dark-mode chart label visibility; mobile padding for prefixed inputs.
- Performance / UX:
  - Improved offline caching and resource freshness; transaction deduplication.
  - Real-time chart updates with source filtering; smoother mobile interactions.

Notes
- 0.6.0 focuses on visual/UX unification. Earlier 0.5.3–0.5.4 introduced backend and migration improvements as listed above.

## [v0.5.5] - 2025-09-09

Summary
- Align Dashboard and Reports chart layouts, remove redundant chart, unify card heights, and fix page title/filter icon vertical alignment.

Added / Changed
- Reports UI and charts:
  - Removed "Income vs Expenses" chart on Reports to match Dashboard conventions.
  - Placed "Source Category Breakdown" next to "Expenses by Category" on desktop (two columns), stacked on mobile.
  - Moved "Balance Trend" below those two charts and set its height to md:h-[370px] for consistency.
  - Made "Expenses by Source" and "Largest Expenses" sections full width on desktop (stacked on mobile).
  - Ensured the new per-source trend components are wired consistently with Dashboard (PerSourceBalanceTrend / PerSourceExpensesTrend usage).
- Dashboard UI:
  - Made the "Balance Trend" chart full width on desktop (lg:col-span-2).
  - Unified its height with other chart cards via md:h-[370px].
- Filter icon alignment:
  - MultiCheckboxDropdown icon-only trigger adjusted by increasing button bottom padding (p-2 !pb-[4px]) to visually align with page titles.
- Minor layout polish:
  - Reports header row uses md:items-center so title and filter control are vertically centered together on desktop.

Fixed
- Vertical misalignment between page titles and filter icon on Dashboard/Reports.
- Inconsistent card heights between charts.

Notes
- These changes focus on visual and layout consistency; underlying data processing and time-range handling remain unchanged.

## [v0.5.4] - 2025-09-09

Summary
- Enhanced shared source display, improved chart visuals, dark mode compatibility, source filtering fixes, and income source cleanup utilities.

Added / Changed
- **Shared Source Display**: Enhanced display names for shared sources across all components showing format "Source Name (Owner Name)" for better identification in dropdowns and filters
- **Chart Improvements**: 
  - Enhanced `SourceCategoryBarChart` with theme-aware legend colors, improved styling, percentage tooltips, and smart data labeling
  - Fixed dark mode label color compatibility (`#d1d5db` in dark mode, `#374151` in light mode)
  - Added top 5 category filtering and enhanced color palettes with borders
- **Source Filtering**: 
  - Fixed source filtering consistency across Dashboard and Reports pages
  - Improved string comparison for source IDs and proper handling of filtered data
  - Enhanced filtered summary calculations and daily expenses processing
- **Backend Enhancements**:
  - Extended sharing controller to include owner information in source queries
  - Added string normalization for transaction updates
  - Improved source filter validation and ownership verification
- **Debug Utilities**: Added comprehensive logging for filtered transaction processing and Reports data flow analysis

Fixed
- Dark mode chart label visibility issues resolved
- Source filtering edge cases with proper string conversion
- Filtered data calculations for summaries and daily expenses
- Owner information display in shared source dropdowns

Tools
- **Income Source Cleanup**: New automated cleanup scripts (`cleanup-income-sources.js` and `.sh`) to identify and migrate incorrectly created income sources to targets, addressing source/target semantic confusion from earlier versions

## [v0.5.3] - 2025-09-09

Summary
- UI polish release featuring page title vertical centering fixes, enhanced filter icons for dark mode, improved source filtering across Dashboard and Reports, new shared data source filtering, and PWA service worker update notifications.

Added / Changed
- **Page Title Vertical Centering**: All page titles now properly vertically centered with consistent typography using `leading-tight` for display classes and `leading-none` + `min-h-[3rem]` for individual page components (Dashboard, Transactions, Reports, Settings, AddTransaction, EditTransaction, AdminTaxonomy, ShareData, EditSharing, UserManagement).
- **Enhanced Filter Icons**: Filter icons in MultiCheckboxDropdown now use proper Icon component with CSS mask-based theming for better dark mode visibility, reduced from 36px to 24px size, less prominent appearance with default variant, and improved vertical centering.
- **Source Filtering Enhancements**: 
  - Added source filter dropdowns to Dashboard and Reports pages using icon-only mode for space-efficient filtering
  - Extended sharing system to include shared data sources with proper permission handling
  - New `SourceCategoryBarChart` component for visualizing spending by category broken down by source
  - Enhanced `getUserSources` endpoint to include both owned and shared sources with source_filter respect
- **PWA Service Worker Updates**: Added comprehensive update notification system with user-friendly modal for app updates including skip waiting functionality and automatic reload.
- **Component System**: New `MultiCheckboxDropdown` component with portal-based positioning, touch-friendly scrolling, and icon-only mode support.

Fixed
- Typography consistency with `leading-tight` applied to all display CSS classes
- Filter icon visibility issues in dark themes resolved through proper CSS mask implementation
- Filter icon sizing and prominence balanced for better visual hierarchy

Performance / UX
- Source filtering with real-time chart updates
- Improved offline data caching with resource freshness tracking and transaction deduplication
- Enhanced sharing system with proper source filtering support

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






