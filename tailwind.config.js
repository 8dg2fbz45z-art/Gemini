/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        crimson: {
          50: '#fdf2f4',
          100: '#fce7ea',
          200: '#f9d2d8',
          300: '#f4adb8',
          400: '#ec7e90',
          500: '#df4f68',
          600: '#c92d4b',
          700: '#A51C30', // Harvard Crimson
          800: '#8b1a2c',
          900: '#771a2a',
          950: '#420a13',
        },
        parchment: {
          50: '#FAF8F5',
          100: '#F4F0EA',
          200: '#E9E2D8',
          300: '#D8CEC0',
        },
        ink: {
          800: '#1C2128',
          900: '#12161B',
          950: '#0B0E12',
        }
      },
      fontFamily: {
        serif: ['"Newsreader"', '"Playfair Display"', 'Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
