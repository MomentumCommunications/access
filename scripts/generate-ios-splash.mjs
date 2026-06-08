import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outputDirectory = path.join(root, "public", "splash", "ios");
const iconDirectory = path.join(root, "public", "icons");
const logoPath = path.join(root, "public", "logo_transparent.png");
const badgeOutputPath = path.join(root, "public", "logo_badge.png");

const devices = [
  { width: 320, height: 568, scale: 2 },
  { width: 375, height: 667, scale: 2 },
  { width: 414, height: 736, scale: 3 },
  { width: 375, height: 812, scale: 3 },
  { width: 414, height: 896, scale: 2 },
  { width: 414, height: 896, scale: 3 },
  { width: 390, height: 844, scale: 3 },
  { width: 428, height: 926, scale: 3 },
  { width: 393, height: 852, scale: 3 },
  { width: 430, height: 932, scale: 3 },
  { width: 402, height: 874, scale: 3 },
  { width: 440, height: 956, scale: 3 },
  { width: 744, height: 1133, scale: 2 },
  { width: 768, height: 1024, scale: 2 },
  { width: 820, height: 1180, scale: 2 },
  { width: 834, height: 1112, scale: 2 },
  { width: 834, height: 1194, scale: 2 },
  { width: 834, height: 1210, scale: 2 },
  { width: 1024, height: 1366, scale: 2 },
  { width: 1032, height: 1376, scale: 2 },
];

const themes = {
  light: {
    background: "#e8e8e8",
    foreground: "#18181b",
  },
  dark: {
    background: "#09090b",
    foreground: "#fafafa",
  },
};

await mkdir(outputDirectory, { recursive: true });

const logoDataUrl = `data:image/png;base64,${(await readFile(logoPath)).toString("base64")}`;

function createBadgeSvg(size) {
  const strokeWidth = Math.max(2, Math.round(size * 0.045));
  const markWidth = Math.round(size * 0.62);
  const markHeight = Math.round(markWidth * (1081 / 1080));

  return Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle
        cx="${size / 2}"
        cy="${size / 2}"
        r="${size / 2 - strokeWidth}"
        fill="none"
        stroke="#ce2128"
        stroke-width="${strokeWidth}"
      />
      <image
        href="${logoDataUrl}"
        x="${Math.round((size - markWidth) / 2)}"
        y="${Math.round((size - markHeight) / 2)}"
        width="${markWidth}"
        height="${markHeight}"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  `);
}

async function createBrandIcon(size, maskable = false) {
  const badgeSize = Math.round(size * (maskable ? 0.72 : 0.94));
  const badgeLeft = Math.round((size - badgeSize) / 2);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: maskable ? "#09090b" : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: createBadgeSvg(badgeSize), left: badgeLeft, top: badgeLeft },
    ])
    .png({ compressionLevel: 9 });
}

for (const size of [72, 96, 120, 128, 144, 152, 167, 180, 192, 384, 512]) {
  await (await createBrandIcon(size)).toFile(
    path.join(iconDirectory, `icon-${size}x${size}.png`),
  );
}

await (await createBrandIcon(512)).toFile(badgeOutputPath);

for (const size of [192, 512]) {
  await (await createBrandIcon(size, true)).toFile(
    path.join(iconDirectory, `icon-${size}x${size}-maskable.png`),
  );
}

for (const device of devices) {
  const pixelWidth = device.width * device.scale;
  const pixelHeight = device.height * device.scale;
  const logoSize = Math.round(
    Math.min(Math.max(device.width * 0.22, 76), 116) * device.scale,
  );
  const titleSize = Math.round(
    Math.min(Math.max(device.width * 0.036, 13), 18) * device.scale,
  );
  const titleGap = Math.round(24 * device.scale);
  const blockHeight = logoSize + titleGap + titleSize;
  const blockTop = Math.round(pixelHeight * 0.46 - blockHeight / 2);
  const logoLeft = Math.round((pixelWidth - logoSize) / 2);
  const logoTop = blockTop;

  for (const [themeName, theme] of Object.entries(themes)) {
    const title = Buffer.from(`
      <svg width="${pixelWidth}" height="${titleSize * 2}" xmlns="http://www.w3.org/2000/svg">
        <text
          x="50%"
          y="${titleSize}"
          fill="${theme.foreground}"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-size="${titleSize}"
          font-weight="700"
          letter-spacing="${Math.round(titleSize * 0.08)}"
          text-anchor="middle"
        >ACCESS MOMENTUM</text>
      </svg>
    `);
    const filename = `launch-${pixelWidth}x${pixelHeight}-${themeName}.png`;

    await sharp({
      create: {
        width: pixelWidth,
        height: pixelHeight,
        channels: 4,
        background: theme.background,
      },
    })
      .composite([
        { input: createBadgeSvg(logoSize), left: logoLeft, top: logoTop },
        {
          input: title,
          left: 0,
          top: logoTop + logoSize + titleGap,
        },
      ])
      .png({ compressionLevel: 9 })
      .toFile(path.join(outputDirectory, filename));
  }
}

console.log(
  `Generated ${devices.length * Object.keys(themes).length} iOS splash images and refreshed the PWA icons.`,
);
