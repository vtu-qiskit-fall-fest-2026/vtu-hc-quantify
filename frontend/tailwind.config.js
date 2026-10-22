/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        tile: 'var(--tile)',
        tileMint: 'var(--tile-mint)',
        tileSage: 'var(--tile-sage)',
        tileDeep: 'var(--tile-deep)',
        tileInk: 'var(--tile-ink)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        ink2: 'var(--ink-2)',
        ink3: 'var(--ink-3)',
        onDeep: 'var(--on-deep)',
        green: 'var(--green)',
        greenHover: 'var(--green-hover)',
        greenSoft: 'var(--green-soft)',
        quantum: 'var(--quantum)',
        warn: 'var(--warn)',
        bad: 'var(--bad)',
        // Backwards compatibility mappings
        bg: 'var(--canvas)',
        panel: 'var(--tile)',
        panel2: 'var(--tile-mint)',
        text: 'var(--ink)',
        text2: 'var(--ink-2)',
        text3: 'var(--ink-3)',
        accent: 'var(--green)',
        ok: 'var(--green)',
      },
      fontFamily: {
        ui: ['var(--font-ui)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        tile: 'var(--r-tile)',
        inner: 'var(--r-inner)',
        pill: 'var(--r-pill)',
      },
      boxShadow: {
        none: 'none',
        hairline: '0 1px 0 rgba(23, 36, 28, 0.04)',
        hover: '0 2px 8px rgba(23, 36, 28, 0.06)',
      },
    },
  },
  plugins: [],
};
