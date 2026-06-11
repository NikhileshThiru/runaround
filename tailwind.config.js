/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#05060a',
        surface: '#0b0d13',
        neon: '#a855f7',
        glow: '#c084fc',
        primary: '#f4f3f7',
        secondary: '#8f93a1',
        success: '#72d4aa',
        warning: '#f0a868',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 24px rgb(168 85 247 / 0.18)',
        panel: '0 24px 70px rgb(0 0 0 / 0.28)',
      },
    },
  },
  plugins: [],
}
