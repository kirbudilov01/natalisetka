/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        surface: '#12121a',
        border: '#1e1e2d',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
      },
    },
  },
  plugins: [],
}
