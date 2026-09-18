const designSystem = require('@oppenheimer/design-system-mobile/tailwind-config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./{app,lib,registry}/**/*.{ts,tsx}', ...designSystem.content],
  presets: [designSystem],
};
