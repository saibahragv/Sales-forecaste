/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial'],
      },
      colors: {
        app: {
          bg: 'hsl(var(--app-bg))',
          fg: 'hsl(var(--app-fg))',
          muted: 'hsl(var(--app-muted))',
          subtle: 'hsl(var(--app-subtle))',
        },
        surface: {
          1: 'hsl(var(--surface-1))',
          2: 'hsl(var(--surface-2))',
          3: 'hsl(var(--surface-3))',
        },
        border: {
          DEFAULT: 'hsl(var(--border))',
          subtle: 'hsl(var(--border-subtle))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          fg: 'hsl(var(--accent-fg))',
          subtle: 'hsl(var(--accent-subtle))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          subtle: 'hsl(var(--success-subtle))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          subtle: 'hsl(var(--warning-subtle))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          subtle: 'hsl(var(--danger-subtle))',
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
