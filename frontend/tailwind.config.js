/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00f0ff',
        secondary: '#f0c163',
        danger: '#ff4834',
        success: '#00c853',
        dark: {
          100: '#1a1a2e',
          200: '#16213e',
          300: '#0f0f23',
          400: '#0a0a1a',
          500: '#050510'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
