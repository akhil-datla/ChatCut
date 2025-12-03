module.exports = {
  purge: {
    enabled: process.env.NODE_ENV === 'production',
    content: ['./src/**/*.{js,jsx,ts,tsx}', './src/**/*.html'],
  },
  theme: {
    extend: {
      colors: {
        'bg-dark': '#1e1e1e',
        'text-offwhite': '#f0f0f0',
        'border-light': '#444444',
        'accent-blue': '#0078d4',
      },
    },
  },
  variants: {},
  plugins: [],
}
