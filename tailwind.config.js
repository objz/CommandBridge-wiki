/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{njk,html,md,js}"],





safelist: [
  "w-4", "h-4", "mt-[1px]", "flex", "gap-2", "gap-4", "rounded-md", "p-4", "pl-12", "pr-4",
  // Info
  "bg-blue-100", "dark:bg-blue-900/40", "text-blue-900", "dark:text-blue-200",
  // Warning 
  "bg-orange-100", "dark:bg-orange-400/20", "text-orange-900", "dark:text-orange-200",
  // Danger
  "bg-red-100", "dark:bg-red-900/40", "text-red-900", "dark:text-red-200",
  // Success
  "bg-green-200", "dark:bg-green-500/30", "text-green-900", "dark:text-green-200",
  // Typography
  "prose", "prose-sm", "dark:prose-invert"
],

  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        inter: ["Inter", "sans-serif"],
      },
    },
  },
  darkMode: ["class"],
}
