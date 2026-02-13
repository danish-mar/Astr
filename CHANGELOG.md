# Changelog

All notable changes to the Astr Protocol project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-02-13

### Added

- **VS Code-Style Inline Autocomplete for Product Specifications**
  - Ghost text suggestions appear as you type in specification fields
  - Suggestions are fetched from existing products in the same category
  - Sorted by frequency (most common values appear first)
  - Accept full suggestion with Shift+Shift (double tap within 300ms)
  - Accept word-by-word with Right Arrow key
  - Works on both product add and edit pages

- **Automatic Price Formatting**
  - Price input now displays with Indian number system formatting (e.g., 1,00,000)
  - Automatically strips non-numeric characters
  - Backend receives clean numeric values (no breaking changes)
  - Works in both add and edit modes
  - Properly initializes formatted display when loading existing products

- **New API Endpoint**
  - `GET /api/v1/products/spec-suggestions/:categoryId/:fieldName` - Returns unique specification values for autocomplete

### Fixed

- Fixed TypeScript type error in `getSpecSuggestions` controller
  - Properly handles Mongoose Map to plain object conversion with `.lean()`
  - Added correct type assertion for specifications field
- Fixed Alpine.js error in product forms
  - Added null check for `field.options` in `hasLinkedFields()` and `getLinkedFields()`
  - Text/number fields don't have options array, only select fields do
- Improved ghost text visibility with proper CSS layering and opacity handling

### Changed

- Replaced HTML5 datalist dropdown with custom inline autocomplete implementation
- Changed autocomplete acceptance from Tab key to Shift+Shift for better UX

## [3.0.5] - Previous Release

_(Previous changelog entries would go here)_
