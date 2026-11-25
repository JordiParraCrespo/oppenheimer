const path = require('node:path');

/** @type {Pick<import('tailwindcss').Config, 'content'>} */
module.exports = {
  content: [path.join(__dirname, 'src/**/*.{ts,tsx}')],
};
