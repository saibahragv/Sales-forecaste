/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial'],
      },
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          surface: 'var(--bg-surface)',
          glass: 'var(--bg-glass)',
        },
        fg: {
          primary: 'var(--fg-primary)',
          secondary: 'var(--fg-secondary)',
          muted: 'var(--fg-muted)',
        },
        border: {
          DEFAULT: 'var(--border-light)',
          light: 'var(--border-light)',
          glow: 'var(--border-glow)',
        },
        accent: {
          base: 'var(--accent-base)',
          hover: 'var(--accent-hover)',
          glow: 'var(--accent-glow)',
        },
        risk: {
          high: 'var(--risk-high)',
          med: 'var(--risk-med)',
          low: 'var(--risk-low)',
        },
      },
      borderRadius: {
        lg: '12px',
        xl: '14px',
      },
      boxShadow: {
        surface: '0 1px 0 rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.10)',
        surfaceHover: '0 2px 0 rgba(15, 23, 42, 0.05), 0 6px 16px rgba(15, 23, 42, 0.14)',
        ring: '0 0 0 3px hsl(var(--accent-subtle))',
      },
    },
  },
  plugins: [],
}
