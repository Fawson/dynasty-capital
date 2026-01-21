/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Sports Modern palette
        surface: {
          DEFAULT: '#1F2937', // gray-800 - cards/panels
          dark: '#111827',    // gray-900 - background
        },
        border: '#374151',    // gray-700
        accent: {
          DEFAULT: '#F59E0B', // amber-500 - primary accent
          hover: '#D97706',   // amber-600
        },
        // Keep legacy sleeper colors for gradual migration
        sleeper: {
          dark: '#1a1a2e',
          primary: '#1F2937',  // Updated to gray-800
          accent: '#374151',   // Updated to gray-700
          highlight: '#F59E0B', // Updated to amber-500
        },
      },
    },
  },
  plugins: [],
}
