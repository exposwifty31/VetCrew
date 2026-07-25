/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,html}",
    "./ui_kits/**/*.{js,ts,jsx,tsx,html}",
    "./guidelines/**/*.html",
    "./*.{html,js}"
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // High-end neutral scale and surfaces mapped to CSS variables
        "surface-base": "var(--surface-base)",
        "surface-card": "var(--surface-card)",
        "surface-card-hover": "var(--surface-card-hover)",
        "surface-overlay": "var(--surface-overlay)",

        // Precise hairline borders
        "border-subtle": "var(--border-subtle)",
        "border-default": "var(--border-default)",
        "border-focus": "var(--border-focus)",

        // Typographic structural weights
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",

        // Status: CRITICAL (vermilion)
        "critical-subtle": "var(--bg-critical-subtle)",
        "critical": "var(--text-critical)",
        "border-critical-subtle": "var(--border-critical-subtle)",

        // Status: ELEVATED (amber)
        "elevated-subtle": "var(--bg-elevated-subtle)",
        "elevated": "var(--text-elevated)",
        "border-elevated-subtle": "var(--border-elevated-subtle)",

        // Status: WATCH (blue)
        "watch-subtle": "var(--bg-watch-subtle)",
        "watch": "var(--text-watch)",
        "border-watch-subtle": "var(--border-watch-subtle)",

        // Status: RUNNING (green)
        "running-subtle": "var(--bg-running-subtle)",
        "running": "var(--text-running)",
        "border-running-subtle": "var(--border-running-subtle)",
      },
      boxShadow: {
        // Soft ambient wide diffusion & high-precision glowing shadows
        "card": "var(--shadow-card)",
        "overlay": "var(--shadow-overlay)",
        "glow-critical": "var(--shadow-glow-critical)",
        "glow-elevated": "var(--shadow-glow-elevated)",
        "glow-watch": "var(--shadow-glow-watch)",
        "glow-running": "var(--shadow-glow-running)",
      },
      fontFamily: {
        ui: ["var(--font-ui)"],
        metric: ["var(--font-metric)"],
        mono: ["var(--font-mono)"],
      },
      animation: {
        "tick-up": "vc-tick-up var(--dur-tick) var(--ease-standard)",
        "tick-down": "vc-tick-down var(--dur-tick) var(--ease-standard)",
        "stale-pulse": "vc-stale-pulse 2s var(--ease-standard) infinite",
        "live-dot": "vc-live-dot 1.8s var(--ease-standard) infinite",
        "spin-slow": "vc-spin 1.2s linear infinite",
      }
    },
  },
  plugins: [],
};
