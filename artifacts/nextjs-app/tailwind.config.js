/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF8F0',
          100: '#FFEEDD',
          200: '#FFD9B3',
          300: '#FFC080',
          400: '#FFA44D',
          500: '#E8832A',
          600: '#C96520',
          700: '#A04D18',
          800: '#7A3810',
          900: '#5C2909',
        },
        earth: {
          50: '#F5F0EA',
          100: '#E8DDD1',
          200: '#D0BAA0',
          300: '#B89470',
          400: '#9A6E48',
          500: '#7D5232',
          600: '#643E26',
          700: '#4D2F1C',
          800: '#382214',
          900: '#28180E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
