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
        primary: {
          red: '#FF4444',
          blue: '#4444FF',
          yellow: '#FFDD44',
          green: '#44AA44',
          orange: '#FF8844',
          purple: '#8844FF',
          teal: '#44DDDD',
        }
      },
      animation: {
        'pulse-glow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'celebrate': 'bounce 1s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
