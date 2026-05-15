import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hytte: {
          cream: '#f5ebd9',
          snow: '#fefcf8',
          parchment: '#ede0c4',
          wood: '#6b4423',
          woodDark: '#3d2715',
          pine: '#3a5a3a',
          pineDark: '#26402a',
          ember: '#c97b3c',
          emberLight: '#e0a06a',
          coal: '#2a1f17',
          ash: '#8a7866',
          birch: '#d9c9a8',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        hytte: '0 2px 6px rgba(61, 39, 21, 0.12), 0 8px 24px rgba(61, 39, 21, 0.08)',
        hytteSm: '0 1px 3px rgba(61, 39, 21, 0.1)',
        emberGlow: '0 0 0 1px rgba(201, 123, 60, 0.4), 0 4px 12px rgba(201, 123, 60, 0.25)',
      },
      backgroundImage: {
        woodGrain:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><defs><filter id='n'><feTurbulence baseFrequency='0.012 0.4' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 0.42  0 0 0 0 0.27  0 0 0 0 0.13  0 0 0 0.18 0'/></filter></defs><rect width='400' height='400' filter='url(%23n)'/></svg>\")",
      },
    },
  },
  plugins: [],
};

export default config;
