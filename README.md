# Motion Labs

Motion Labs is a browser-based video editor built with React and Vite. It combines a Premiere-style timeline workflow, live program/source monitors, a resource manager, and canvas-based composition controls in a single responsive interface.

## Live Demo

- [https://motionlabz.netlify.app/](https://motionlabz.netlify.app/)

## Current Layout

- Desktop: project/resources on the left, source/program monitors in the center, properties/source tabs on the right, timeline at the bottom.
- Desktop panes are resizable horizontally, including the project bin and preview panels, and the timeline is resizable vertically.
- Mobile: stacked layout with compact header actions and tabbed navigation for timeline, assets, and properties.

## Features

- Multi-track timeline editing with selectable gaps, delete-gap actions, snapping, ripple edit mode, markers, track delete controls, and Premiere-style layer headers
- Separate video and audio lanes, with imported video automatically split into linked video and audio clips
- Audio clips render real waveforms, including audio extracted from video
- Source monitor and program monitor both include transport controls, timecode, scrub bar, and playhead UI
- Program preview supports selecting items directly on canvas, resizing media, and resetting selected media to fit the frame
- Resource manager supports real thumbnails for videos and images, audio preview tiles, adjustable thumbnail size, and `Seq` / `Grid` views
- Browser export flow with working composition export, frame-rate options, supported codec detection, and presets for 720p, 1080p, 1440p, and 4K
- Multi-select clip editing, split-at-playhead behavior, linked clip movement, and independent deletion of separated audio/video clips
- Save/load project support with IndexedDB-backed media persistence
- Recording/import flow for video, audio, and images directly into the editor
- AI-assisted component and image generation via `@google/genai`
- Dark and light themes

## Tech Stack

- React 19
- TypeScript
- Vite 6
- IndexedDB for local project and asset persistence
- MediaRecorder and canvas-based rendering for browser export
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

- `App.tsx` — root editor shell, responsive layout, editor state, import flow, and export wiring
- `components/panels/` — assets, source monitor, properties, settings, audio, and color panels
- `components/preview/` — program monitor and canvas/video preview surface
- `components/timeline/` — timeline tracks, waveforms, gap handling, and editing controls
- `components/ui/` — shared transport controls, export modal, tools, and menu bar
- `services/` — Gemini integration helpers
- `utils/` — IndexedDB, history, project file helpers, and browser export pipeline

## Notes

- Export depends on browser-supported codecs, so output formats are limited to what `MediaRecorder` supports in that browser.
- AI generation features require a valid Gemini API key in settings.
