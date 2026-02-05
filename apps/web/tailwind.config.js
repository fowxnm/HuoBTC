/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6', // Business Blue
        secondary: '#64748B', // Slate Gray
        danger: '#EF4444',
        success: '#10B981',
        warning: '#F59E0B',
        // Legacy Dark Mode colors (preserved for compatibility if needed)
        dark: {
          100: '#1a1a2e',
          200: '#16213e',
          300: '#0f0f23',
          400: '#0a0a1a',
          500: '#050510'
        },
        // Business White Theme (Admin)
        admin: {
          bg: '#F3F4F6',    // gray-100
          card: '#FFFFFF',  // white
          text: '#1F2937',  // gray-800
          sub: '#6B7280',   // gray-500
          border: '#E5E7EB',// gray-200
          hover: '#F9FAFB', // gray-50
          sidebarTextActive: '#3B82F6' // blue-500
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
