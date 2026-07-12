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
          bg: "rgb(var(--panel-bg-rgb) / <alpha-value>)",
          card: "rgb(var(--panel-card-rgb) / <alpha-value>)",
          border: "rgb(var(--panel-border-rgb) / <alpha-value>)",
          text: "rgb(var(--panel-text-rgb) / <alpha-value>)",
          /** Buttons, nav highlights — branding Primary */
          accent: "rgb(var(--brand-primary-rgb) / <alpha-value>)",
          /** Links and focus — branding Accent */
          link: "rgb(var(--brand-accent-rgb) / <alpha-value>)",
          muted: "rgb(var(--panel-muted-rgb) / <alpha-value>)",
        },
      },
      borderRadius: {
        qadbak: "var(--qadbak-radius)",
        "qadbak-lg": "var(--qadbak-radius-lg)",
        "qadbak-xl": "var(--qadbak-radius-xl)",
      },
      boxShadow: {
        panel: "0 1px 0 rgb(var(--panel-border-rgb) / 0.4), 0 8px 24px rgb(0 0 0 / 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
