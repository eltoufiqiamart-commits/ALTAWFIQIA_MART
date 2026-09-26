import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    screens: {
      xs: "360px",
      sm: "480px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1440px",
    },
    extend: {
      colors: {
        // Derived from the approved Tawfiqia Mart logo.
        brand: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#bcd7ff",
          300: "#8ebeff",
          400: "#5997ff",
          500: "#2f76fe",
          600: "#146bfd", // logo blue
          700: "#0f57e0",
          800: "#1248b4",
          900: "#14408e",
          950: "#0f2a57",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#f07000", // logo orange
          700: "#c2550a",
          800: "#9a4310",
          900: "#7c3811",
          950: "#431c06",
        },
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5dae2",
          300: "#b0bac9",
          400: "#8593aa",
          500: "#66748f",
          600: "#515d76",
          700: "#434c60",
          800: "#3a4151",
          900: "#1f2937",
          950: "#141925",
        },
        success: "#15803d",
        successBg: "#f0fdf4",
        warning: "#b45309",
        warningBg: "#fffbeb",
        danger: "#dc2626",
        dangerBg: "#fef2f2",
        info: "#0369a1",
      },
      fontFamily: {
        sans: ["var(--font-cairo)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 42, 87, 0.06), 0 2px 8px rgba(20, 42, 87, 0.05)",
        pop: "0 8px 30px rgba(15, 42, 87, 0.12)",
      },
      maxWidth: {
        shell: "1280px",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(-100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s cubic-bezier(0.2,0,0,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
