import colors from 'tailwindcss/colors';

const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;
const surfaces = {
  darkest: 'canvas', dark: 'panel', medium: 'raised', light: 'hover', lighter: 'border',
  border: 'border', 'border-light': 'border-strong', text: 'text', 'text-dim': 'muted',
  'text-bright': 'bright', accent: 'accent', 'accent-hover': 'accent-hover', timecode: 'accent',
  'menu-bg': 'panel', 'menu-hover': 'hover', 'tab-active': 'raised', 'tab-inactive': 'panel',
  'input-bg': 'canvas', 'input-border': 'border', 'button-bg': 'raised', 'button-hover': 'hover'
};

export default {
  content: ['./index.html', './App.tsx', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pp: {
          ...Object.fromEntries(Object.entries(surfaces).map(([key, value]) => [key, token(value)])),
          'clip-video': '#4a7fb5', 'clip-audio': '#4caf50', 'clip-text': '#e57373',
          'clip-image': '#ab47bc', 'clip-adjustment': '#ff9800', playhead: '#ff5252'
        },
        gray: { ...colors.neutral, 750: '#333333', 850: '#202020', 950: '#0a0a0a' }
      },
      fontFamily: {
        pp: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        'pp-mono': ['Menlo', 'Monaco', 'Consolas', 'monospace']
      }
    }
  }
};
