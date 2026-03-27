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
        paper: "#f7f3eb",
        ink: "#102434",
        accent: "#e2762b",
        mint: "#d9ede4",
        line: "#d8d1c5",
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
