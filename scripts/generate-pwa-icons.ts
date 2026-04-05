import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ICONS_DIR = join(ROOT, 'public', 'icons');
const SVG_PATH = join(ROOT, 'public', 'favicon.svg');

const baseSvg = readFileSync(SVG_PATH, 'utf-8');
const squareSvg = baseSvg.replace('rx="6"', 'rx="0"');

mkdirSync(ICONS_DIR, { recursive: true });

async function generateStandard(size: number, filename: string) {
  await sharp(Buffer.from(squareSvg))
    .resize(size, size)
    .png()
    .toFile(join(ICONS_DIR, filename));
  console.log(`  ${filename} (${size}x${size})`);
}

async function generateMaskable(size: number, filename: string) {
  const logoSize = Math.round(size * 0.8);
  const offset = Math.round(size * 0.1);
  const logoBuffer = await sharp(Buffer.from(squareSvg))
    .resize(logoSize, logoSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 208, g: 135, b: 112, alpha: 1 }, // aurora.orange — primary CTA token
    },
  })
    .composite([{ input: logoBuffer, top: offset, left: offset }])
    .png()
    .toFile(join(ICONS_DIR, filename));
  console.log(`  ${filename} (${size}x${size}, maskable)`);
}

async function main() {
  console.log('Generating PWA icons...');

  await Promise.all([
    generateStandard(192, 'icon-192.png'),
    generateStandard(512, 'icon-512.png'),
    generateMaskable(192, 'icon-maskable-192.png'),
    generateMaskable(512, 'icon-maskable-512.png'),
    // Apple touch icon in public root (not icons/)
    sharp(Buffer.from(squareSvg)).resize(180, 180).png()
      .toFile(join(ROOT, 'public', 'apple-touch-icon.png'))
      .then(() => console.log('  apple-touch-icon.png (180x180)')),
  ]);

  console.log('Done.');
}

main();
