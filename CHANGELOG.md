# Changelog

## Version 2.0.0 (Current)

### Major Changes
- ❌ **Removed Google OAuth** - No authentication needed anymore
- ❌ **Removed Google Sheets API** - Now works with local Excel files only
- ❌ **Removed AI/Analyze features** - Simplified to core sync functionality
- ✅ **Added XLSX support** - Direct upload and parsing of Excel files
- ✅ **New simple UI** - Single screen with drag-drop and sync button

### Technical Changes
- Added `xlsx` library for Excel file parsing
- Removed OAuth flow and all Google API dependencies
- Simplified component structure (removed wizard steps)
- Updated image loading to work through UI with CORS proxy fallback
- Removed external API dependencies (google-sheet-sync-api.vercel.app)

### Features Retained
- ✅ Layer name matching with `#` prefix
- ✅ Text, image, color, variant support
- ✅ Special prefixes (`/show`, `/hide`, `/#color`)
- ✅ Template cloning and population
- ✅ Row selection in table view

### Bug Fixes
- Fixed image loading for CORS-restricted sources (e.g., Google Drive)
- Added CORS proxy fallback for images that can't be loaded directly
- Fixed manifest network access configuration

## Version 1.0.0 (Original)

### Features
- Google OAuth authentication
- Google Sheets API integration
- Multi-step wizard UI
- AI/Analyze features
- Tab selection from Google Sheets
- Image loading from Google Drive
- Component variant support
- Color and text syncing


