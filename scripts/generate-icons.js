const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Icon sizes for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create SVG with LDC logo - amber/gold on dark background
function createSvg(size) {
  const fontSize = Math.floor(size * 0.35);
  const padding = Math.floor(size * 0.15);

  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#18181b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#09090b;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#bgGrad)"/>

      <!-- Border accent -->
      <rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="${size * 0.14}" fill="none" stroke="url(#grad)" stroke-width="2"/>

      <!-- LDC Text -->
      <text
        x="50%"
        y="50%"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        fill="url(#grad)"
        text-anchor="middle"
        dominant-baseline="middle"
      >LDC</text>

      <!-- Subtle command symbol -->
      <path
        d="M${size * 0.3} ${size * 0.75} L${size * 0.5} ${size * 0.85} L${size * 0.7} ${size * 0.75}"
        stroke="#d97706"
        stroke-width="${size * 0.02}"
        fill="none"
        stroke-linecap="round"
        opacity="0.7"
      />
    </svg>
  `;
}

// Create badge SVG (for notifications)
function createBadgeSvg(size) {
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="url(#badgeGrad)"/>
      <text
        x="50%"
        y="50%"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${size * 0.5}"
        font-weight="700"
        fill="#09090b"
        text-anchor="middle"
        dominant-baseline="middle"
      >L</text>
    </svg>
  `;
}

// Create shortcut icons
const shortcutConfigs = {
  'shortcut-today': { emoji: '📅', color: '#3b82f6' },
  'shortcut-chat': { emoji: '💬', color: '#8b5cf6' },
  'shortcut-rfp': { emoji: '📊', color: '#10b981' },
};

function createShortcutSvg(size, config) {
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="${config.color}"/>
      <text
        x="50%"
        y="55%"
        font-size="${size * 0.5}"
        text-anchor="middle"
        dominant-baseline="middle"
      >${config.emoji}</text>
    </svg>
  `;
}

async function generateIcons() {
  console.log('Generating PWA icons...');

  // Generate main app icons
  for (const size of sizes) {
    const svg = createSvg(size);
    const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);

    console.log(`Created: icon-${size}x${size}.png`);
  }

  // Generate badge icon
  const badgeSvg = createBadgeSvg(72);
  await sharp(Buffer.from(badgeSvg))
    .png()
    .toFile(path.join(ICONS_DIR, 'badge-72x72.png'));
  console.log('Created: badge-72x72.png');

  // Generate shortcut icons
  for (const [name, config] of Object.entries(shortcutConfigs)) {
    const svg = createShortcutSvg(96, config);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(ICONS_DIR, `${name}.png`));
    console.log(`Created: ${name}.png`);
  }

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
