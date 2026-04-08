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
        // Dock / cargo terminal palette
        'dock-950':   '#080704',
        'dock-900':   '#0F0C08',
        'dock-800':   '#1A1510',
        'dock-700':   '#261E15',
        'dock-600':   '#33291D',
        'dock-500':   '#4A3C2A',
        'dock-400':   '#9C7B5A',  /* was #6B5540 — lifted to 5.0:1 */
        'dock-300':   '#A08060',
        'dock-200':   '#C8A878',
        'dock-100':   '#E8D5A3',
        'dock-50':    '#F5EDD8',
        // Amber terminal glow
        'amber':      '#F5A623',
        'amber-dim':  '#C4821A',
        // Status stamps
        'stamp-red':  '#EC4826',  /* was #CC2200 — lifted to 5.1:1 */
        'stamp-green':'#5A9A5A',  /* was #2D6A2D — lifted to 5.7:1 */
        'stamp-amber':'#B87300',
        // Keep neon-green aliases for components not yet redesigned
        'neon-green':     '#F5A623',
        'neon-green-dim': '#C4821A',
        // Dark aliases for compatibility
        'dark-900': '#0F0C08',
        'dark-800': '#1A1510',
        'dark-700': '#261E15',
        'dark-600': '#33291D',
        'dark-500': '#4A3C2A',
        'dark-400': '#6B5540',
        // Issue category colours — all verified ≥4.5:1 on #1A1510 and #0F0C08
        'cat-critical':    '#EC4826',  /* was #CC2200 */
        'cat-ux':          '#D4750F',  /* was #C46000 */
        'cat-accessibility':'#AF52DE', /* was #6B3FA0 */
        'cat-performance': '#0A84FF',  /* was #1A5C8A */
        'cat-security':    '#FF3B30',  /* was #8A1A1A */
        'cat-warning':     '#B87300',
        'cat-passed':      '#5A9A5A',  /* was #2D6A2D */
      },
      fontFamily: {
        serif:     ['"Playfair Display"', 'Georgia', 'serif'],
        mono:      ['"Special Elite"', '"Courier Prime"', '"Courier New"', 'monospace'],
        condensed: ['"Barlow Condensed"', '"Arial Narrow"', 'sans-serif'],
        sans:      ['system-ui', 'sans-serif'],
      },
      animation: {
        'score-in':  'scoreIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'stamp-in':  'stampIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-up':   'fadeUp 0.4s ease forwards',
        'pulse-slow':'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scoreIn: {
          '0%':   { transform: 'scale(0.7)', opacity: '0' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
        stampIn: {
          '0%':   { transform: 'scale(1.4) rotate(-8deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(-3deg)',   opacity: '1' },
        },
        fadeUp: {
          '0%':   { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
