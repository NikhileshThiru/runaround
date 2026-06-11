/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#030609',
        surface: '#0a111a',
        neon: '#27c0e8',
        glow: '#7ce4ff',
        primary: '#e6f1f7',
        secondary: '#7e8c9a',
        success: '#56d8a4',
        warning: '#ffb454',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 24px rgb(39 192 232 / 0.16)',
        panel: '0 20px 60px rgb(0 0 0 / 0.3)',
      },
    },
  },
  plugins: [],
}
