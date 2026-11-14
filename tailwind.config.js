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
          950: '#1b1e24',
          900: '#21252b',
          850: '#282c34',
          800: '#303640',
          750: '#383f4a',
          700: '#414957',
          600: '#596273',
        },
        gold: {
          300: '#f2d49b',
          400: '#e5c07b',
          500: '#d19a66',
          600: '#b27c4c',
        },
        arcane: {
          300: '#dfb4e8',
          400: '#c678dd',
          500: '#ae69c4',
          600: '#9453aa',
        },
        frost: {
          400: '#a7c9ee',
          500: '#61afef',
          600: '#428ac5',
        },
        blood: {
          500: '#e06c75',
          600: '#be555e',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
