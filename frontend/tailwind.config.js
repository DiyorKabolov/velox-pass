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
        // Headings and anything set in capitals at a size you read at a glance.
        display: ['"Sofia Sans Condensed"', '"Arial Narrow"', 'sans-serif'],
        // Posters, page titles and the big numbers: the playbill voice.
        poster: ['"Sofia Sans Extra Condensed"', '"Sofia Sans Condensed"', '"Arial Narrow"', 'sans-serif'],
        sans: ['"Golos Text"', 'system-ui', 'sans-serif'],
        mono: ['"Martian Mono"', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        card: 'var(--radius)',
        sm2: 'var(--radius-sm)'
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)'
      }
    }
  },
  plugins: []
}
