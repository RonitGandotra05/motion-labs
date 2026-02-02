# Motion Labs

A browser-based, React + TypeScript video editor prototype built with Vite. It includes a timeline editor, layer/track management, a preview canvas, and basic asset handling to explore non-linear editing workflows in the browser.

## Features

- Multi-track timeline with playhead, zoom, and snapping-friendly layout
- Asset library with drag-to-track and upload support
- Layer controls (visibility, lock, ordering)
- Video/audio/image/text/shape elements
- Theme toggle (light/dark)
- Export/preview panel scaffolding

## Tech Stack

- React 19 + TypeScript
- Vite 6
- @google/genai (for AI-generated asset experiments)

## Getting Started

```bash
npm install
npm run dev
```

Then open the local dev server printed in the terminal.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — build for production
- `npm run preview` — preview the production build

## Project Structure

- `App.tsx` — main editor shell and state management
- `components/` — editor UI, timeline, panels, and preview
- `services/` — API/AI integrations
- `utils/` — helpers and local data utilities
- `constants.ts` / `types.ts` — shared config and types

## Notes

This is a prototype editor UI. Media processing/export may be partial or mocked, depending on the panel implementation.

## License

Add a license if you plan to distribute or open-source this project.
