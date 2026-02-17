/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#f6f8f6',
          100: '#e3ebe3',
          200: '#c7d7c9',
          300: '#a1bba4',
          400: '#7a9d7e',
          500: '#5d8560',
          600: '#486a4b',
          700: '#3a543d',
          800: '#304532',
          900: '#28392a',
        },
        terracotta: {
          50: '#fdf6f4',
          100: '#fae8e3',
          200: '#f5d4ca',
          300: '#ecb5a4',
          400: '#e18b74',
          500: '#d46a4e',
          600: '#c05139',
          700: '#a0412f',
          800: '#85392a',
          900: '#6f3327',
        },
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neo': '4px 4px 0px 0px rgba(0,0,0,1)',
        'neo-sm': '2px 2px 0px 0px rgba(0,0,0,1)',
        'neo-lg': '8px 8px 0px 0px rgba(0,0,0,1)',
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
