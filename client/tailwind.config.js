/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tactical dark military palette — concrete, steel, hazard amber, kill red.
        base: {
          900: "#070809",
          800: "#0a0c0f",
          700: "#101317",
          600: "#171b21",
          500: "#1f242c",
          400: "#2a313a",
          300: "#3a434f",
        },
        steel: "#8b95a3",
        accent: {
          DEFAULT: "#f5a623", // hazard amber
          dim: "#b87d18",
        },
        kill: "#ff3b30",
        verify: "#33d17a",
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};
