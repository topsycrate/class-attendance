import type { Config } from "tailwindcss";

const config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#f6f5f1",
        ink: "#18212f",
        accent: "#0f766e",
        mint: "#dcf7f1",
        line: "#d9dee8",
        sidebar: "#121a27",
        "sidebar-soft": "#1e293b",
        muted: "#687386",
        rose: "#be123c",
        amber: "#b7791f",
        "amber-soft": "#fff3d6",
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Noto Sans SC"', "sans-serif"],
        display: ['"Avenir Next"', '"SF Pro Display"', '"PingFang SC"', "sans-serif"],
      },
      boxShadow: {
        card: "0 20px 45px rgba(16, 36, 52, 0.08)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
} satisfies Config;

export default config;
