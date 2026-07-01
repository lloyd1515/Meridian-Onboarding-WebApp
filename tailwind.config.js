/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        'text-primary': "var(--color-text-primary)",
        'text-muted': "var(--color-text-muted)",
        accent: "var(--color-accent)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
      },
      fontFamily: {
        sans: ["'Outfit'", "'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        none: "0px",
        sm: "2px",
        md: "4px",
        lg: "6px",
        xl: "12px",
        '2xl': "16px",
        '3xl': "20px",
        'full': "9999px",
      },
      spacing: {
        '0.5': "2px",
        '1': "4px",
        '2': "8px",
        '3': "12px",
        '4': "16px",
        '5': "20px",
        '6': "24px",
        '8': "32px",
        '10': "40px",
        '12': "48px",
        '16': "64px",
        '20': "80px",
        '24': "96px",
      },
      fontSize: {
        'display': ['40px', { lineHeight: '44px', fontWeight: '700' }],
        'h1': ['32px', { lineHeight: '36px', fontWeight: '700' }],
        'h2': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'h3': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'h4': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'mono': ['14px', { lineHeight: '20px', fontWeight: '400' }],
      }
    },
  },
  plugins: [],
}
