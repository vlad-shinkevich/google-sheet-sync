# Excel to Figma Sync

A Figma plugin that syncs data from Excel (XLSX) files directly into your Figma designs.

## Features

- 📊 **Drag & Drop Excel Files** - Simple upload interface for XLSX files
- 🎯 **Direct Sync** - No authentication or external services needed
- 🔄 **Row Selection** - Choose which rows to sync to Figma
- 🎨 **Smart Layer Mapping** - Automatically maps Excel columns to Figma layers by name

## How It Works

This plugin follows the same layer naming convention as documented at [docs.sheetssync.app](https://docs.sheetssync.app/):

### 1. Name Your Figma Layers

Add a `#` prefix followed by the column name from your Excel file:

- `#Title` - will be filled with the "Title" column
- `#Image` - will load an image from a URL in the "Image" column
- `#Color` - will apply a color from the "Color" column

**Note:** Layer names are case-insensitive and ignore spaces.

### 2. Upload Your Excel File

1. Open the plugin in Figma
2. Drag and drop your XLSX file or click to browse
3. Select the rows you want to sync
4. Click "Sync to Figma"

### 3. Data Types Supported

The plugin automatically detects and applies:

- **Text** - Plain text content
- **Images** - URLs that point to images (PNG, JPG, GIF, WebP, SVG)
- **Colors** - Hex color codes (e.g., #FF5733)
- **Variants** - Component variant properties (e.g., `Type=Primary, Size=Large, State=Default`)
- **Links** - Hyperlinks for text layers
- **Visibility** - Use `/show` or `/hide` to control layer visibility

### 4. Special Prefixes

For text layers that need special handling, prefix values with `/`:

- `/show` - Show the layer
- `/hide` - Hide the layer
- `/#FF5733` - Apply color to text

## Installation

### Development Mode

```bash
npm install
npm run dev
```

This will watch for changes and rebuild automatically.

### Production Build

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Usage in Figma

1. Select a frame to use as a template
2. Run the plugin
3. Upload your Excel file
4. Select rows from the table
5. Click "Sync to Figma"

The plugin will create clones of your template frame and populate them with data from the selected rows.

## Excel File Format

Your Excel file should have:
- **First row** as headers (column names)
- **Subsequent rows** as data

Example:

| Title | Description | Image | Color |
|-------|-------------|-------|-------|
| Card 1 | First card | https://example.com/image1.jpg | #FF5733 |
| Card 2 | Second card | https://example.com/image2.jpg | #33FF57 |

## Layer Naming Examples

```
Frame: #CardTemplate
├── Text: #Title
├── Text: #Description
├── Rectangle: #Image
└── Rectangle: #Color
```

## Technical Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Excel Parsing**: XLSX (SheetJS)
- **UI Components**: Radix UI, Lucide Icons
- **Build Tool**: Vite

## Changes from Original

This version removes:
- ❌ Google OAuth authentication
- ❌ Google Sheets API integration
- ❌ AI/Analyze features
- ❌ Multi-step wizard UI

Replaced with:
- ✅ Simple drag-drop XLSX upload
- ✅ Direct file parsing (no external services)
- ✅ Streamlined single-screen UI

## Development

### Project Structure

```
src/
├── code.ts                 # Figma plugin code
├── lib/
│   └── figma/              # Figma API helpers
├── ui/
│   ├── main.tsx            # UI entry point
│   ├── components/         # React components
│   │   ├── XlsxUpload.tsx
│   │   └── SimpleDataTable.tsx
│   └── lib/                # UI utilities
```

### Scripts

- `npm run dev` - Development mode with watch
- `npm run build` - Production build
- `npm run typecheck` - TypeScript type checking
- `npm run lint` - ESLint
- `npm run lint:fix` - ESLint with auto-fix

## License

[Your License Here]
