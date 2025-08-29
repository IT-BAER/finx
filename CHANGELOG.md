# Changelog

All notable changes to this project are documented in this file.

## [v0.5.1] - 2025-08-28

This is a small release that includes a hotfix for mobile input spacing and a new realtime search feature for transactions.

### Highlights

- Fix: increase mobile padding for prefixed inputs to 2.5rem to avoid layout issues on small screens.
- Feature: realtime transaction search with umlaut (accent) support, debounced and accent-insensitive filtering across columns. Infinite scroll is paused while searching to avoid extra server requests. Mobile search input spacing was improved. A search icon and translations were added.

### Commits (range: v0.5.0..v0.5.1)

- 292faafe — fix(ui): increase mobile padding for prefixed inputs to 2.5rem (author: baer)
  - Files changed: `frontend/src/styles/index.css`

- 9a9a4159 — feat(transactions): add realtime search with umlaut support; mobile search input spacing; translations; use search icon (author: baer)
  - Files added/modified:
    - `frontend/public/icons/search.svg` (added)
    - `frontend/src/pages/Transactions.jsx` (modified)
    - `frontend/src/styles/index.css` (modified)
    - `frontend/src/translations/de.js` (modified)
    - `frontend/src/translations/en.js` (modified)

### Notes

- This release is backwards compatible with v0.5.0. If you build from source ensure you have the repository tags available; the Git range used was `v0.5.0..v0.5.1`.

## [v0.5.0] - (previous)

- Previous release (no changelog here in this file).

---

Unreleased changes should go under an `Unreleased` heading at the top of this file.
