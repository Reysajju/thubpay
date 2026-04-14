const { fontFamily } = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'pages/**/*.{ts,tsx}'
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        sans: [
          'Montserrat',
          'Inter',
          'var(--font-sans)',
          ...fontFamily.sans
        ]
      },
      colors: {
        thubpay: {
          obsidian: '#111111',
          gold: '#C5A059',
          slate: '#555555',
          blue: '#0A6C7B',
          'blue-accent': '#0A6C7F',
          surface: '#161616',
          elevated: '#1c1c1c',
          border: '#2d2d2d',
          muted: '#9ca3af',
          // Legacy keys (used across components) → brand mapping
          violet: '#C5A059',
          'violet-dark': '#a68447',
          'violet-light': '#d4b578',
          cyan: '#0A6C7B',
          'cyan-dark': '#085a66',
          'cyan-light': '#0d8294',
          dark: '#111111',
          'dark-2': '#141414',
          'dark-3': '#1a1a1a',
          'dark-4': '#222222'
        }
      },
      backgroundImage: {
        'thubpay-gradient':
          'linear-gradient(135deg, #C5A059 0%, #0A6C7B 100%)',
        'thubpay-gradient-subtle':
          'linear-gradient(135deg, rgba(197,160,89,0.18) 0%, rgba(10,108,123,0.18) 100%)',
        'thubpay-radial':
          'radial-gradient(ellipse at 50% 0%, rgba(197,160,89,0.25) 0%, transparent 60%)',
        'card-glow':
          'radial-gradient(ellipse at 50% 0%, rgba(197,160,89,0.12) 0%, transparent 70%)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 0.6 },
          '50%': { opacity: 1 }
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 2.5s linear infinite',
        float: 'float 4s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.6s ease-out forwards'
      },
      boxShadow: {
        'thubpay-violet': '0 0 30px rgba(197,160,89,0.35)',
        'thubpay-cyan': '0 0 28px rgba(10,108,123,0.35)',
        'card-hover': '0 20px 60px rgba(197,160,89,0.18)',
        glow: '0 0 20px rgba(197,160,89,0.35), 0 0 40px rgba(10,108,123,0.2)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
