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
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in forwards',
        'slide-in': 'slideIn 0.2s ease-out forwards',
      },
    },
  },
  plugins: [],
}
