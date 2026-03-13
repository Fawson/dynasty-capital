/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Unified design tokens
        surface: {
          DEFAULT: '#1F2937', // gray-800 - cards/panels
          dark: '#111827',    // gray-900 - background
        },
        border: '#374151',    // gray-700
        accent: {
          DEFAULT: '#F59E0B', // amber-500 - primary accent
          hover: '#D97706',   // amber-600
        },
        // Legacy aliases (mapped to new tokens for backward compatibility)
        sleeper: {
          dark: '#111827',     // → surface-dark
          primary: '#1F2937',  // → surface
          accent: '#374151',   // → border
          highlight: '#F59E0B', // → accent
        },
      },
    },
  },
  plugins: [],
}
