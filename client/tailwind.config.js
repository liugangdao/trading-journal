/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0e17',
        card: '#111827',
        border: '#1e293b',
        accent: '#3b82f6',
        green: '#10b981',
        red: '#ef4444',
        gold: '#f59e0b',
        purple: '#8b5cf6',
        text: '#e2e8f0',
        muted: '#64748b',
        input: '#1e293b',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    }
  },
  plugins: []
}
