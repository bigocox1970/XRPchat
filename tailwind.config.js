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
          // Dark mode natural theme colors - updated to beige/cream tones
          'dark-primary': '#8B5A2B',
          'dark-secondary': '#A67C52',
          'dark-accent': '#BF8756',
          'dark-background': '#2C2318', // Darker warm brown instead of dark blue
          'dark-paper': '#4A3C31',      // Medium warm brown
          'dark-text': '#F0E6D6',       // Cream color for text
          'dark-muted': '#BEA68D',      // Lighter beige for muted text
          'dark-border': '#6B563D',     // Medium beige for borders
          // Toggle and active button colors
          'toggle-active': '#A67C52',    // Warm brown for active toggles (replacing green-500)
          'toggle-active-dark': '#BF8756', // Slightly lighter warm brown for dark mode toggles
          'button-active-bg': 'rgba(166, 124, 82, 0.2)',   // Semi-transparent version of toggle-active
          'button-active-bg-dark': 'rgba(191, 135, 86, 0.3)',  // Semi-transparent version of toggle-active-dark
          'button-active-text': '#8B5A2B',  // Brown text for active buttons (replacing green-800)
          'button-active-text-dark': '#F2E6D0', // Light beige text for dark mode buttons (replacing green-100)
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
