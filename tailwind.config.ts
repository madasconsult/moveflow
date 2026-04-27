import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta MOVE FLOW — corporativo, limpo, profissional
        brand: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d7fe',
          300: '#a5bbfd',
          400: '#8098fb',
          500: '#5c6ef7',
          600: '#3d4eec',  // primária
          700: '#3139d3',
          800: '#2a30aa',
          900: '#272e86',
          950: '#191c4f',
        },
        neutral: {
          50:  '#f8f9fa',
          100: '#f1f3f5',
          200: '#e9ecef',
          300: '#dee2e6',
          400: '#ced4da',
          500: '#adb5bd',
          600: '#868e96',
          700: '#495057',
          800: '#343a40',
          900: '#212529',
          950: '#0d0f11',
        },
        // Status de projeto
        status: {
          'not-started':  '#adb5bd',
          'in-progress':  '#4dabf7',
          'at-risk':      '#ffd43b',
          'delayed':      '#ff6b6b',
          'completed':    '#51cf66',
          'suspended':    '#cc5de8',
          'cancelled':    '#868e96',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      spacing: {
        'sidebar': '256px',
        'sidebar-collapsed': '72px',
        'header': '60px',
      },
      boxShadow: {
        'card':  '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.10)',
        'sidebar': '1px 0 0 0 #e9ecef',
      },
      borderRadius: {
        'card': '10px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
