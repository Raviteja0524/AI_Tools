/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#09090B',
          surface: '#111116',
          elevated: '#17171F',
        },
        border: {
          subtle: '#1F1F2E',
          strong: '#2D2D3E',
        },
        primary: {
          DEFAULT: '#7C3AED',
          glow: '#7C3AED40',
          light: '#9D65F5',
          dark: '#5B21B6',
        },
        accent: {
          DEFAULT: '#06B6D4',
          glow: '#06B6D440',
          light: '#38D1ED',
          dark: '#0891B2',
        },
        text: {
          primary: '#F8F8F8',
          muted: '#A1A1AA',
          faint: '#52525B',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'hero-gradient': 'radial-gradient(ellipse 80% 60% at 50% 0%, #2D1B69 0%, #09090B 60%)',
        'card-shine': 'linear-gradient(135deg, #ffffff05 0%, transparent 50%)',
        'purple-glow': 'radial-gradient(circle at center, #7C3AED30, transparent 70%)',
        'cyan-glow': 'radial-gradient(circle at center, #06B6D430, transparent 70%)',
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M0 40L40 0M-10 10L10-10M30 50L50 30' stroke='%237C3AED' stroke-width='0.3' opacity='0.15'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'glow-purple': '0 0 20px #7C3AED40, 0 0 40px #7C3AED20',
        'glow-cyan': '0 0 20px #06B6D440, 0 0 40px #06B6D420',
        'glow-sm': '0 0 10px #7C3AED30',
        'card': '0 4px 24px #00000060',
        'card-hover': '0 8px 40px #00000080',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-up': 'slideUp 0.5s ease forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% center' },
          to: { backgroundPosition: '200% center' },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#A1A1AA',
            maxWidth: 'none',
            a: { color: '#7C3AED', '&:hover': { color: '#9D65F5' } },
            h1: { color: '#F8F8F8' },
            h2: { color: '#F8F8F8' },
            h3: { color: '#F8F8F8' },
            h4: { color: '#F8F8F8' },
            strong: { color: '#F8F8F8' },
            code: { color: '#06B6D4', background: '#111116', padding: '0.2em 0.4em', borderRadius: '0.25em' },
            pre: { background: '#111116', border: '1px solid #1F1F2E' },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
