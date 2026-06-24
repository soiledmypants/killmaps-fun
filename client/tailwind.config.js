/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Desert tactical palette — warm dark sand/earth, hazard amber, kill red.
        base: {
          900: "#0c0a06",
          800: "#13110b",
          700: "#1b1810",
          600: "#241f15",
          500: "#31291b",
          400: "#403524",
          300: "#564833",
        },
        steel: "#a89a7e",
        sand: "#d9c69a",
        terracotta: "#b5623c",
        accent: {
          DEFAULT: "#f0a72e", // desert sun amber
          dim: "#bd7d1c",
        },
        kill: "#e8492f",
        verify: "#8bb04f",
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
