/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Forest battlefield palette — deep forest greens, bark browns, tactical gold.
        base: {
          900: "#0A1F0A",
          800: "#0D2818",
          700: "#14301F",
          600: "#1A3A2A",
          500: "#27492F",
          400: "#38583C",
          300: "#4E7052",
        },
        // Dark bark browns — secondary surfaces (inspector panels, card accents).
        bark: {
          900: "#1E160E",
          800: "#2A1F14",
          700: "#3D2E1F",
          600: "#52402C",
        },
        steel: "#8B9E7C", // sage — secondary text
        sand: "#E8E4D9", // parchment — primary text tone
        terracotta: "#7A4A2B",
        accent: {
          DEFAULT: "#D4A017", // tactical amber/gold
          dim: "#C5961A",
        },
        kill: {
          DEFAULT: "#B22A2A", // blood red (readable on dark green)
          deep: "#8B1A1A",
        },
        verify: "#3ECF3E",
        bull: "#2D5A27",
        bear: "#5A3A1F",
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"],
        display: ["'Black Ops One'", "'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};
