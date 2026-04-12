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
        sans: ['Inter', 'var(--font-sans)', ...fontFamily.sans]
      },
      colors: {
        thubpay: {
          violet: '#6C5CE7',
          'violet-dark': '#5849C2',
          'violet-light': '#8B7FF0',
          cyan: '#00B4D8',
          'cyan-dark': '#0096B7',
          'cyan-light': '#48CAE4',
          dark: '#0A0A0F',
          'dark-2': '#12121A',
          'dark-3': '#1A1A28',
          'dark-4': '#22223A',
          surface: '#16161F',
          border: '#2A2A42',
          muted: '#8888AA'
        }
      },
      backgroundImage: {
        'thubpay-gradient': 'linear-gradient(135deg, #6C5CE7 0%, #00B4D8 100%)',
        'thubpay-gradient-subtle':
          'linear-gradient(135deg, rgba(108,92,231,0.15) 0%, rgba(0,180,216,0.15) 100%)',
        'thubpay-radial':
          'radial-gradient(ellipse at 50% 0%, rgba(108,92,231,0.3) 0%, transparent 60%)',
        'card-glow':
          'radial-gradient(ellipse at 50% 0%, rgba(108,92,231,0.12) 0%, transparent 70%)'
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
        'thubpay-violet': '0 0 30px rgba(108,92,231,0.3)',
        'thubpay-cyan': '0 0 30px rgba(0,180,216,0.3)',
        'card-hover': '0 20px 60px rgba(108,92,231,0.2)',
        glow: '0 0 20px rgba(108,92,231,0.4), 0 0 40px rgba(0,180,216,0.2)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
