/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        glass: "rgba(255, 255, 255, 0.15)"
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
