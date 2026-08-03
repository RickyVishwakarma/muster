/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#ffffff", // page background
        ink: "#0a0a0a", // primary text / black
        line: "#e5e5e5", // borders
        soft: "#f7f7f7", // subtle panel fill
        muted: "#6b7280", // secondary text
      },
    },
  },
  plugins: [],
};
