module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: "#FF5CAA",
          purple: "#7C3AED",
          blue: "#00D4FF",
          ink: "#0B0C10",
          glass: "rgba(255,255,255,0.06)"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.25)"
      }
    }
  },
  plugins: []
};
