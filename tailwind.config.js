/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#07060a',
          900: '#0c0a13',
          850: '#12101b',
          800: '#181524',
          700: '#231f33',
          600: '#342f4c',
        },
        gold: {
          300: '#ffeb99',
          400: '#ffd84d',
          500: '#f6c324',
          600: '#d9a714',
        },
        arcane: {
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
        },
        frost: {
          400: '#7dd3fc',
          500: '#38bdf8',
          600: '#0284c7',
        },
        blood: {
          500: '#ef4444',
          600: '#dc2626',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        display: ['Cinzel', 'Trajan Pro', 'serif'],
      }
    },
  },
  plugins: [],
}
