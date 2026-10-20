import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0E1722",
          800: "#1B2736",
          700: "#2B3A4D",
          600: "#43536A",
          500: "#5B6B7F",
          400: "#8593A6",
          300: "#B8C2CF",
          200: "#DCE2EA",
          100: "#EDF1F6",
          50: "#F6F8FB",
        },
        brand: {
          DEFAULT: "#006FFE",
          50: "#EBF4FF",
          100: "#D6E8FF",
          200: "#ADD1FF",
          500: "#006FFE",
          600: "#0059CC",
          700: "#0045A0",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-bn)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-bn)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(14,23,34,0.04), 0 8px 30px rgba(14,23,34,0.08)",
        card: "0 1px 2px rgba(14,23,34,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
