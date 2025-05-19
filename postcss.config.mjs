// postcss.config.mjs (or postcss.config.js)

// This configuration explicitly uses @tailwindcss/postcss as suggested by the error message.
const config = {
  plugins: {
    '@tailwindcss/postcss': {}, // Use the specific PostCSS plugin package
    autoprefixer: {},
  },
};

export default config;
