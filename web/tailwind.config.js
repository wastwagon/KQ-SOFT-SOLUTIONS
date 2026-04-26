/** @type {import('tailwindcss').Config} */
/* Brand colours: mirror of `src/index.css` @theme. Prefer editing @theme, then copy scales here. */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8f4ff',
          100: '#cce6ff',
          200: '#99ccff',
          300: '#66b2ff',
          400: '#3d9af5',
          500: '#1a7de8',
          600: '#0473ea',
          700: '#0356b0',
          800: '#044080',
          900: '#062e57',
        },
        green: {
          50: '#f0fff0',
          100: '#dcfcc6',
          200: '#b3f78a',
          300: '#7deb4d',
          400: '#5ce021',
          500: '#38d200',
          600: '#2db000',
          700: '#228a00',
          800: '#1a6b00',
          900: '#145200',
        },
        surface: '#f8fafc',
        border: { DEFAULT: '#e2e8f0', muted: '#f1f5f9' },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
}
