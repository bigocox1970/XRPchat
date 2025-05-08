/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#075e54',
          secondary: '#128c7e',
        },
        natural: {
          // Light mode natural theme colors
          primary: '#8B5A2B',
          secondary: '#A67C52',
          accent: '#D4A76A',
          background: '#F9F6F0',
          paper: '#FFFFFF',
          text: '#4A3C31',
          muted: '#9C8C7D',
          border: '#E5DBCC',
          // Dark mode natural theme colors - beige/cream tones
          'dark-primary': '#8B5A2B',    // Rich brown for headers
          'dark-secondary': '#A67C52',  // Medium brown
          'dark-accent': '#BF8756',     // Light brown accent
          'dark-background': '#F5EEE0', // Cream background (replacing dark blue)
          'dark-paper': '#D2BC9B',      // Beige for content areas (replacing grey/blue)
          'dark-text': '#4A3C31',       // Dark brown text on cream background
          'dark-muted': '#8B7A65',      // Muted text color
          'dark-border': '#C9B28F',     // Light beige for borders
          // Toggle and active button colors
          'toggle-active': '#A67C52',    // Warm brown for active toggles (replacing green-500)
          'toggle-active-dark': '#BF8756', // Slightly lighter warm brown for dark mode toggles
          'button-active-bg': 'rgba(166, 124, 82, 0.2)',   // Semi-transparent version of toggle-active
          'button-active-bg-dark': 'rgba(191, 135, 86, 0.3)',  // Semi-transparent version of toggle-active-dark
          'button-active-text': '#8B5A2B',  // Brown text for active buttons (replacing green-800)
          'button-active-text-dark': '#4A3C31', // Dark brown text for dark mode buttons (was "#F2E6D0")
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in forwards',
        'slide-in': 'slideIn 0.2s ease-out forwards',
      },
    },
  },
  plugins: [
    function({ addVariant }) {
      // Add natural-light variant
      addVariant('natural-light', '.natural-light &');
      // Add natural-dark variant
      addVariant('natural-dark', '.natural-dark &');
    },
  ],
}
