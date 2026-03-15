import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Electric green accent
        'neon-green': '#00FF88',
        'neon-green-dim': '#00C269',
        // Dark background palette
        'dark-900': '#0A0A0A',
        'dark-800': '#111111',
        'dark-700': '#1A1A1A',
        'dark-600': '#222222',
        'dark-500': '#2A2A2A',
        'dark-400': '#333333',
        // Issue category colors
        'cat-critical': '#FF3B30',
        'cat-ux': '#FF9500',
        'cat-accessibility': '#AF52DE',
        'cat-performance': '#0A84FF',
        'cat-security': '#CC0000',
        'cat-warning': '#FFD60A',
        'cat-passed': '#00FF88',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'score-in': 'scoreIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'fade-up': 'fadeUp 0.5s ease forwards',
      },
      keyframes: {
        scoreIn: {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
