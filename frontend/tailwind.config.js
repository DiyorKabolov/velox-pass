/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        line: 'var(--border)',
        line2: 'var(--border2)',
        ink: 'var(--text)',
        muted: 'var(--muted)',
        muted2: 'var(--muted2)',
        accent: 'var(--accent)',
        ok: 'var(--ok)',
        err: 'var(--err)',
        warn: 'var(--warn)'
      },
      fontFamily: {
        display: ['Unbounded', 'sans-serif'],
        sans: ['Manrope', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      borderRadius: {
        card: 'var(--radius)',
        sm2: 'var(--radius-sm)'
      }
    }
  },
  plugins: []
}
