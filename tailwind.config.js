/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(96, 165, 250, 0.22)',
        capsule: '0 18px 80px rgba(15, 23, 42, 0.45)',
      },
      backgroundImage: {
        'radial-grid': 'radial-gradient(circle at top left, rgba(59, 130, 246, 0.24), transparent 30%), radial-gradient(circle at bottom right, rgba(168, 85, 247, 0.18), transparent 28%)',
      },
    },
  },
  plugins: [],
}
