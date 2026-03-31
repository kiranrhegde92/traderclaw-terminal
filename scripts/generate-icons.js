#!/usr/bin/env node

/**
 * Generate PWA icons for TraderClaw Terminal
 * Creates 192x192 and 512x512 PNG icons with green terminal theme
 */

const fs = require('fs')
const path = require('path')

// Simple PNG generator for basic shapes
// Creates a minimal valid PNG with the TraderClaw green theme
function createSimplePNG(size) {
  // Use a data URL for a simple green square with terminal aesthetic
  // This is a minimal 1x1 green pixel PNG encoded as base64, then scaled
  const greenPixel =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='

  // For a proper icon, we should create SVG then convert
  // But for now, we'll create a valid small PNG with transparent background
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <!-- Black background -->
      <rect width="${size}" height="${size}" fill="#0a0a0a"/>
      <!-- Green terminal text/symbol -->
      <rect x="${size * 0.15}" y="${size * 0.15}" width="${size * 0.7}" height="${size * 0.7}" fill="none" stroke="#00ff41" stroke-width="${size * 0.05}" rx="${size * 0.05}"/>
      <text x="${size * 0.5}" y="${size * 0.6}" font-size="${size * 0.4}" font-weight="bold" fill="#00ff41" text-anchor="middle" font-family="monospace">TC</text>
    </svg>
  `

  // Note: In a real implementation, you would use a PNG library like 'sharp'
  // For now, we'll just document that PNG files should be created
  return svg
}

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, '..', 'public')
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

// Note: The actual PNG generation requires 'sharp' or 'canvas' library
// For development, you can use online SVG to PNG converters or tools like:
// 1. ImageMagick: convert icon.svg icon-192x192.png
// 2. ffmpeg: ffmpeg -i icon.svg -s 192x192 icon-192x192.png
// 3. Inkscape: inkscape --export-type=png -w 192 -h 192 icon.svg

console.log('PWA Icon Generation')
console.log('==================')
console.log('')
console.log('To generate proper PNG icons, follow these steps:')
console.log('')
console.log('1. Install ImageMagick (if not already installed)')
console.log('   - macOS: brew install imagemagick')
console.log('   - Windows: choco install imagemagick')
console.log('   - Linux: sudo apt-get install imagemagick')
console.log('')
console.log('2. Create an SVG icon file at public/icon.svg')
console.log('')
console.log('3. Convert SVG to PNG icons:')
console.log('   convert -background none -density 192 public/icon.svg -resize 192x192 public/icon-192x192.png')
console.log('   convert -background none -density 512 public/icon.svg -resize 512x512 public/icon-512x512.png')
console.log('')
console.log('Alternative: Use online tools like:')
console.log('- https://convertio.co/svg-png/')
console.log('- https://cloudconvert.com/svg-to-png')
console.log('')
console.log('SVG Icon Template:')
console.log('==================')

// Create the SVG template
const svgTemplate = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Black background -->
  <rect width="512" height="512" fill="#0a0a0a"/>
  <!-- Green terminal border -->
  <rect x="76" y="76" width="360" height="360" fill="none" stroke="#00ff41" stroke-width="25" rx="25"/>
  <!-- Terminal text -->
  <text x="256" y="320" font-size="140" font-weight="bold" fill="#00ff41" text-anchor="middle" font-family="monospace, Courier New">TC</text>
</svg>`

const svgPath = path.join(publicDir, 'icon.svg')
fs.writeFileSync(svgPath, svgTemplate)
console.log(`Created: ${svgPath}`)

console.log('')
console.log('Next steps:')
console.log('1. Convert the SVG to PNG using one of the methods above')
console.log('2. Place icon-192x192.png and icon-512x512.png in the public/ directory')
console.log('3. Restart the dev server to use the PWA with icons')
