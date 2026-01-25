# Changelog

All notable changes to this project are documented in this file.

## [v0.8.7] - 2025-01-30

### Removed (Backend)
- **Push Notifications**: Removed all FCM/Firebase push notification infrastructure
  - Aligns with mobile app v0.9.6 which switched to SSE + background-fetch
  - Deleted: `services/fcm.js`, `models/DeviceToken.js`, `controllers/pushController.js`, `routes/push.js`
  - Removed `device_tokens` table from database schema
  - Removed `firebase-admin` dependency from package.json

### Added (Frontend)
- **Translation Keys**: Added new translation keys to all 10 language files:
  - `calendarWeekShort`: Abbreviated calendar week labels (CW, KW, S, W, T, Н, 周)
  - `unknown`: Label for unknown/unspecified values
  - `currencySymbol`: Locale-appropriate currency symbols ($, €, zł, ₽, ¥)

### Improved (Frontend)
- **Localization**: Extended locale support from 2 languages (English, German) to all 10 supported languages
  - Created centralized `getLocaleString()` utility in `utils/locale.js`
  - Date formatting now uses proper BCP 47 locale codes for all languages:
    - English (en-US), German (de-DE), Spanish (es-ES), French (fr-FR), Italian (it-IT)
    - Portuguese (pt-PT), Dutch (nl-NL), Polish (pl-PL), Russian (ru-RU), Chinese (zh-CN)

- **Chart Labels**: Updated all chart components to use locale-aware date formatting
  - `DailyExpensesChart.jsx`: Weekly labels now show localized weekday abbreviations
  - `PerSourceExpensesTrend.jsx`: Monthly labels use localized month names
  - `PerSourceBalanceTrend.jsx`: All time range labels now properly localized
  - `Dashboard.jsx`: Month display and weekday formatting use correct locales
  - `Reports.jsx`: All date labels (weekly, monthly, yearly) now locale-aware

### Fixed (Frontend)
- **Hardcoded Strings**: Replaced hardcoded German/English patterns with proper translations
  - Default target "Misc"/"Sonstiges" now uses `t("misc")` translation
  - Currency symbol display now uses `t("currencySymbol")` instead of hardcoded € or $

---

## [v0.8.6] - 2025-01-29

### Security
- Updated `tar` package to fix CVE-2026-23950 (race condition via Unicode collisions)
- Updated `undici` package to fix decompression chain vulnerability in Node.js Fetch API
- Updated `react-router` and `react-router-dom` in frontend to fix multiple vulnerabilities:
  - CSRF issue in Action/Server Action Request Processing
  - XSS via Open Redirects
  - SSR XSS in ScrollRestoration
  - Unexpected external redirect via untrusted paths

---

## [v0.8.3] - 2026-01-08

### fix

- **Rate Limiting**: Refactored rate limiting with tiered approach for finance apps
  - Previous config was too strict (only 10 auth requests per 15 min including token refresh!)
  - New global limit: 120 requests per minute (handles sync bursts)
  - Auth-specific limiters per endpoint:
    - Login/Register: 15 failed attempts per 15 min (bruteforce protection)
    - Token Refresh: 20 requests per minute (mobile background sync friendly)
    - Password Change: 5 attempts per hour
    - Account Deletion: 3 attempts per 24 hours
  - Transaction/Recurring routes: 60 writes per minute
  - Token refresh now separate from login - won't block legitimate refresh calls
  - Successful requests skipped for login/register (won't lock out legitimate users)
  - Using `standardHeaders: "draft-7"` for modern rate limit headers

## [v0.8.2] - 2026-01-08

### fix

- **Reports**: Fixed Balance Trend (Saldoentwicklung) chart discrepancy between web and mobile
  - Added initial balance calculation from transactions BEFORE the selected date range
  - Web now shows actual running balance (like mobile) instead of cumulative change from zero
  - Refactored source ID extraction into reusable helper function for consistency
  - Both "Other" aggregated sources and individual sources now include initial balance

- **Reports**: Fixed time-range-aware average expense calculations on web
  - Weekly view: Shows average daily expenses (total / days)
  - Monthly view: Shows average weekly expenses (total / weeks)  
  - Yearly view: Shows average monthly expenses (total / 12)
  - Dynamic label updates based on selected time range

- **Database**: Fixed DATE type timezone issues in PostgreSQL
  - Configured pg driver to return DATE types as strings (YYYY-MM-DD) instead of JavaScript Date objects
  - Prevents server timezone from shifting dates during serialization
  - Ensures consistent date handling across all environments

## [v0.8.1] - 2026-01-07

### fix

- **Validation**: Fixed crash in Zod error formatting middleware
  - Added defensive null check in `formatZodErrors` function
  - Handle cases where `error.errors` is undefined by falling back to `error.issues`
  - Added safe property access with optional chaining to prevent unhandled rejections
  - Prevents server crash when validation errors have unexpected structure

- **Validation**: Allow category_id, source_id, target_id in transaction schema
  - Mobile app sends ID-based references alongside name-based references
  - Added `category_id`, `source_id`, `target_id` as optional fields to `createTransactionSchema`
  - Fixes 400 Bad Request error when creating transactions from mobile app

## [v0.8.0] - 2026-01-03

### feat

#### TypeScript & React Query Integration
- **TypeScript**: Added TypeScript support to frontend with strict type checking
  - Created `tsconfig.json` with modern TypeScript 5.x configuration
  - Added comprehensive type definitions in `frontend/src/types/index.ts`
  - Type definitions for Transaction, Category, Source, Target, Goal, User, and more
  - Added `vite-env.d.ts` for Vite environment types
- **React Query**: Integrated TanStack React Query v5 for server state management
  - Created `frontend/src/lib/queryClient.ts` with optimized configuration (5min staleTime, 30min gcTime)
  - Created comprehensive `frontend/src/hooks/useQueries.ts` with 25+ custom hooks
  - Query hooks: `useCategories`, `useSources`, `useTargets`, `useTransaction`, `useGoals`, `useInfiniteTransactions`
  - Mutation hooks: `useCreateTransaction`, `useUpdateTransaction`, `useDeleteTransaction`
  - Goal hooks: `useCreateGoal`, `useUpdateGoal`, `useDeleteGoal`, `useAddGoalContribution`
  - Admin hooks: `useAdminUsers`, `useCreateAdminUser`, `useUpdateAdminUser`, `useDeleteAdminUser`
  - Sharing hooks: `useSharingPermissions`, `useSharedWithMe`, `useSharingUsers`, `useSharingSources`, `useCreateSharingPermission`, `useUpdateSharingPermission`, `useDeleteSharingPermission`
  - Dashboard and profile hooks: `useDashboardSummary`, `useUserProfile`, `useUpdateUserProfile`
  - Automatic cache invalidation on mutations with cross-query coordination

#### Backend Validation with Zod
- **Validation**: Added Zod schema validation middleware
  - Created `middleware/validation/schemas.js` with comprehensive validation schemas
  - Created `middleware/validation/index.js` with reusable validation middleware
  - Validation for transactions (create/update), goals, sharing permissions
  - Type coercion for numeric fields, date validation, enum constraints
  - Human-readable error messages for validation failures
- **API Routes**: Applied Zod validation to all major API endpoints
  - Transaction routes: create, update validated with body schemas
  - Goal routes: create, update, contribution endpoints validated
  - Sharing routes: create, update permission validated
  - Auth routes: login validated

#### Database Performance Optimization
- **Indexes**: Added database migration for performance indexes
  - Created `database/migrations/011-add-performance-indexes.sql`
  - Composite index on `transactions(user_id, date)` for faster date-range queries
  - Index on `transactions(category_id)` for category filtering
  - Index on `transactions(source_id)` for source filtering
  - Index on `transactions(target_id)` for target filtering
  - Index on `transactions(recurring_transaction_id)` for recurring lookups
  - Index on `goals(user_id)` for user goal queries

#### Internationalization Expansion
- **Languages**: Added 8 new translation files for broader international support
  - Spanish (`es.js`), French (`fr.js`), Italian (`it.js`)
  - Dutch (`nl.js`), Polish (`pl.js`), Portuguese (`pt.js`)
  - Russian (`ru.js`), Chinese (`zh.js`)
  - Complete translations for all UI strings (350+ keys per language)
- **Translation Updates**: Enhanced English and German translations
  - Added new keys for About page, settings, goals, validation errors
  - Improved translation coverage for edge cases

#### New About Page
- **About**: Created new About page (`frontend/src/pages/About.jsx`)
  - Displays app version and build information
  - Shows changelog highlights
  - Links to documentation and support
  - Accessible from Settings page

#### Page Animations
- **Animations**: Created `frontend/src/components/AnimatedPage.jsx`
  - Reusable animation wrapper components
  - Smooth page transitions using Framer Motion
  - `AnimatedPage`, `AnimatedSection`, `AnimatedStagger`, `AnimatedItem` components
  - Consistent animation patterns across the application
- **Motion Theme**: Enhanced `frontend/src/utils/motionTheme.js`
  - Centralized animation configuration
  - Consistent timing and easing functions

#### UI/UX Improvements
- **Settings Page**: Complete redesign with improved layout
  - Reorganized into logical sections (Profile, Appearance, Privacy, etc.)
  - Better mobile responsiveness
  - Improved accessibility
- **Settings Page**: Income Tracking Toggle
  - Added user preference to disable income tracking (expense-only mode)
  - Backend support in User model for `income_tracking_disabled` field
  - Conditional UI rendering based on preference
- **Dashboard**: Source filtering improvements
  - Better handling of shared sources in filter dropdown
  - Display owner name for shared sources
- **Goals Page**: Enhanced with React Query
  - Faster data loading with caching
  - Automatic refresh on goal updates

### Pages Migrated to React Query
- `AddTransaction.jsx` - Uses `useCategories`, `useSources`, `useTargets`
- `EditTransaction.jsx` - Uses `useCategories`, `useSources`, `useTargets`, `useTransaction`
- `Goals.jsx` - Uses `useGoals` and goal mutation hooks
- `UserManagement.jsx` - Uses admin user hooks
- `ShareData.jsx` - Uses sharing permission hooks
- `EditSharing.jsx` - Uses sharing hooks
- `Transactions.jsx` - Uses `useDeleteTransaction` with event-based refresh
- `Dashboard.jsx` - Event-based refresh integration
- `Reports.jsx` - Event-based refresh integration

### fix
- **Infinite Scroll**: Updated `useInfiniteTransactions` hook to use `getAllTransactions` with proper offline merge
- **Mutation Sync**: All transaction mutations now dispatch custom events (`transactionAdded`, `transactionUpdated`, `transactionDeleted`, `dataRefreshNeeded`) for backward compatibility with event-based refresh patterns

### chore
- Added `@tanstack/react-query` v5.x dependency
- Added `@tanstack/react-query-devtools` for development debugging
- Added `zod` v3.x dependency for schema validation
- Added TypeScript dependencies (`typescript`, type definitions)
- Updated ESLint configuration for TypeScript support
- Created hooks barrel export (`frontend/src/hooks/index.ts`)
- Created lib barrel export (`frontend/src/lib/index.ts`)
- Added sample data insertion script (`scripts/insert-sample-data.sql`)
- Added new logo assets in `frontend/public/logos/`
- Added info icon in `frontend/public/icons/`
- Removed PWA-related files (InstallButton, InstallPrompt, PWAStatus, PWAUpdatePrompt, pwa.js)
- Updated package versions to 0.8.0

### removed
- **PWA**: Removed Progressive Web App functionality
  - Removed `InstallButton.jsx`, `InstallPrompt.jsx` components
  - Removed `PWAStatus.jsx`, `PWAUpdatePrompt.jsx` components
  - Removed `frontend/src/utils/pwa.js` utility
  - Removed `frontend/manifest.webmanifest`
  - Removed PWA-related Vite configuration
  - Removed PWA documentation (`docs/PWA-README.md`)

## [v0.7.4] - 2026-01-01

### feat
- **Caching**: Redis caching integration with in-memory LRU fallback
- **Caching**: Dashboard data caching with automatic invalidation on transaction changes
- **Authentication**: Refresh token flow with secure token rotation
- **Authentication**: Token family tracking for reuse attack detection
- **Real-time**: SSE endpoint improvements for mobile app support

### chore
- Added `ioredis` dependency for Redis support
- Added Redis installation option to setup.sh

## [v0.7.3] - 2025-12-13

### fix
- **Recurring Transactions**: Fixed end-of-month scheduling bug (e.g., Jan 31 -> Feb 28) using UTC-safe date logic
- **Recurring Transactions**: Enforced data integrity by verifying category ownership on creation/update
- **Recurring Transactions**: Prevented duplicate rule creation (same title/amount/start date)
- **Recurring Transactions**: Improved critical error logging for category mismatches

### feat
- **Services**: Integrated centralized logging system (Winston) + HTTP request logging (Morgan) for better observability

### security
- **Frontend Dependencies**: Resolved high-severity vulnerability in `glob` (via `npm audit fix`)

### chore
- Updated backend version to 0.7.3 and frontend to 0.7.2

## [v0.7.2] - 2025-12-13

### feat
- **Recurring Transactions**: Implemented `GET /api/recurring-transactions` endpoint
  - Added `getAllRecurringTransactions` controller logic
  - Added `findAllByUserId` method to RecurringTransaction model
  - Enables fetching all recurring rules for the authenticated user (critical for mobile app support)

### chore
- Updated version numbers to 0.7.2 across package.json files

## [v0.7.1] - 2025-12-08

### fix
- **Sharing**: Fixed 500 error in shared transactions fetch
  - Added missing `hasPermission` method to SharingPermission model
  - Resolved crash when verifying access rights for shared resources

### chore
- Updated version numbers to 0.7.1 across package.json files

## [v0.7.0] - 2025-11-26

### feat
- **Goals**: New savings goals feature for tracking financial targets
  - Create, edit, and delete savings goals with custom names, target amounts, and deadlines
  - Visual progress bars showing current amount vs target
  - Add contributions to goals with optional notes
  - Goal icons (savings, vacation, car, home, education, emergency, gift, tech, health)
  - Customizable goal colors (10 color options)
  - Summary dashboard showing total saved, total target, active goals, and overall progress
  - Mark goals as completed with celebration indicator
  - Filter toggle to show/hide completed goals (preference persists in localStorage)
  - Deadline tracking with overdue/near-deadline warnings
- **Navigation**: Goals page added to mobile bottom navigation (replaces Settings)
- **Navigation**: Goals page added to desktop sidebar navigation
- **Database**: New goals and goal_contributions tables with auto-updating triggers
- **API**: Full CRUD endpoints for goals at /api/goals
- **i18n**: Complete English and German translations for goals feature (40+ keys)

### fix
- **Swipe Navigation**: Fixed swipeable-wrapper not filling viewport height
  - Added CSS for .swipeable-wrapper flex container
  - Set min-height on .swipeable-page for full swipe detection area

### chore
- Updated version numbers to 0.7.0 across package.json files

## [v0.6.4] - 2025-10-15

### feat
- **Real-time Sync**: Recurring transaction changes now broadcast to all connected devices via SSE
  - Backend emits recurring:create, recurring:update, and recurring:delete events
  - Frontend automatically refreshes when other users or devices modify recurring transactions
  - Ensures immediate visibility of changes across all sessions

### fix
- **Recurring Transactions**: Fixed recurring transaction icon not appearing on newly created transactions
  - Frontend: Added recurring transaction creation logic to AddTransaction page
  - Frontend: Fixed offlineAPI snapshot mapping to include recurring_id field
  - Backend: recurringTransactionController now updates transaction.recurring_transaction_id after creating recurring rule
  - Resolved bidirectional relationship issue between transactions and recurring rules
- **Recurring Transactions**: Fixed date format warnings in EditTransaction page
  - HTML date inputs now receive proper yyyy-MM-dd format instead of ISO timestamps
- **Recurring Transactions**: Fixed timezone issue causing date shifts in end dates
  - Backend now preserves yyyy-MM-dd format dates without timezone conversion
  - Prevents dates like 2025-10-16 from shifting to 2025-10-15
- **Recurring Transactions**: Fixed prefetch transaction cache not clearing on recurring changes
  - Real-time updates now properly clear all relevant caches for immediate UI refresh
- **Installation**: Fixed setup.sh to correctly install latest GitHub release instead of arbitrary versions
  - Installer now properly uses release archive when detected via GitHub API
  - Added `--strip-components=1` for correct archive extraction
  - Removes existing .git directory when switching from git-based to archive-based installation
  - Ensures users always get the actual latest release instead of older cached versions

### security  
- **Frontend Dependencies**: Updated PostCSS from 8.5.6 to 8.4.49 for latest security patches
- **Frontend Dependencies**: Updated vite-plugin-pwa from 0.21.2 to 1.1.0 for security improvements and Vite 6+ compatibility

### chore
- Updated version numbers to 0.6.4 across package.json files

## [v0.6.3] - 2025-10-12

### feat
- **Recurring Transactions**: Auto-created transactions now properly include category, source, and target fields
- **Recurring Transactions**: Auto-created transactions now display recurring icon (🔁) in transaction lists
- **Recurring Transactions**: Added ability to edit recurring transaction rules through any auto-created transaction
- **Database**: Added `recurring_transaction_id` column to transactions table for better tracking

### fix
- **Recurring Processor**: Added category validation to ensure categories exist before creating transactions
- **Recurring Processor**: Enhanced logging to show which fields (category, source, target) are set when creating transactions
- **API**: Updated transaction queries to properly return recurring transaction data for auto-created transactions

### chore
- Added database migration 008 for recurring_transaction_id column
- Updated version numbers to 0.6.3 across package.json files

## [v0.6.2] - 2025-10-10

### security
- **Build tooling**: Upgraded Vite stack to 6.3.6 / @vitejs/plugin-react 5.0.4 to pick up fs.strict HTML guard and sirv 3.0.2 fixes ([vite@6.3.6](https://github.com/vitejs/vite/releases/tag/v6.3.6))
- **HTTP client**: Bumped axios to 1.12.x to keep pace with upstream fetch interoperability hardening ([axios@1.12.2](https://github.com/axios/axios/releases/tag/v1.12.2))

### chore
- Raised minimum Node.js version to 20.19+ per Vite 6 guidance
- Regenerated frontend lockfile to reflect the dependency updates above

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






