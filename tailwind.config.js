/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Nunito',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
      colors: {
        admin: {
          dark: '#111827',
          sidebar: '#111827',
          background: '#F8FAFC',
          muted: '#64748B',
          accent: '#007A24',
          border: '#E5E7EB',
        },
        brand: {
          50: '#F0FAF2',
          100: '#DEF3E3',
          200: '#BCE5C7',
          300: '#8BD29F',
          400: '#45AD64',
          500: '#007A24',
          600: '#00651E',
          700: '#00551A',
          800: '#164B2A',
          900: '#123D25',
        },
      },
      boxShadow: {
        soft: '0 18px 45px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
}
