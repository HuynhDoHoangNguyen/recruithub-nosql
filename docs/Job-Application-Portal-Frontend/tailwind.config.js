/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          green: '#00b14f', // TopCV signature green
          red: '#ed1b2f',   // ITviec signature red
          dark: '#0f172a',
          blue: '#1e40af',
        }
      },
      boxShadow: {
        'soft': '0 2px 14px -2px rgba(15, 23, 42, 0.06), 0 1px 4px -1px rgba(15, 23, 42, 0.04)',
        'hover': '0 12px 28px -4px rgba(30, 64, 175, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.06)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
      }
    },
  },
  plugins: [],
};

export default config;
