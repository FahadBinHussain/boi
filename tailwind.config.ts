import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        // Latin first, Bengali second: Inter carries the Latin UI, and Bengali
        // glyphs (which Inter does not have) fall through to Hind Siliguri.
        // Both vars are defined by next/font in src/app/layout.tsx.
        sans: [
          'var(--font-inter)',
          'var(--font-bengali)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({ strategy: 'class' }),
    require('daisyui'),
  ],
  daisyui: {
    themes: true,
  },
} satisfies Config;
