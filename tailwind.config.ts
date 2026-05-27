import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        panel: {
          bg: "#0f1419",
          card: "#1a2332",
          border: "#2d3a4f",
          /** Buttons, nav highlights — maps to branding Primary color */
          accent: "rgb(var(--brand-primary-rgb) / <alpha-value>)",
          /** Links and secondary highlights — maps to branding Accent color */
          link: "rgb(var(--brand-accent-rgb) / <alpha-value>)",
          muted: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
