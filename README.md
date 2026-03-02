# Motion Labs

Motion Labs is a browser-based video editor built with React and Vite. It combines a timeline-driven editing workflow with a live canvas preview, a resource manager, and element property controls in a single responsive interface.

## Live Demo

- [motionlabz.netlify.app](https://motionlabz.netlify.app)

## Current Layout

- Desktop: resource manager on the left, video preview in the center, properties panel on the right, timeline at the bottom.
- Desktop panes are resizable horizontally, and the timeline is resizable vertically.
- Mobile: stacked layout with compact header actions and tabbed navigation for timeline, assets, and properties.

## Features

- Multi-track timeline editing with snapping, ripple edit mode, markers, and layer controls
- Canvas-style preview with selectable and editable elements
- Resource manager for importing, recording, and reusing video, audio, and image assets
- Element property editing for text, shapes, media, and adjustment layers
- AI-assisted component and image generation via `@google/genai`
- Save/load project support and in-browser export flow
- Dark and light themes

## Tech Stack

- React 19
- TypeScript
- Vite 6
- IndexedDB for local project and asset persistence
- Netlify-ready static deployment via `dist/`

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm run preview
```

Netlify is configured through `netlify.toml` to publish the Vite `dist` output.

## Project Structure

- `App.tsx` — root editor shell, responsive layout, and editor state
- `components/panels/` — assets, properties, settings, audio, and color panels
- `components/preview/` — canvas/video preview surface
- `components/timeline/` — timeline tracks, waveform, and editing controls
- `services/` — Gemini integration helpers
- `utils/` — IndexedDB, history, and project file helpers

## Notes

- This is still a prototype editor. Some media processing and export paths are simplified.
- AI generation features require a valid Gemini API key in settings.
