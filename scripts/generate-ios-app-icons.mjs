import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const outputDir = path.join(root, "ios", "Throughline", "Assets.xcassets", "AppIcon.appiconset");

const iconSpecs = [
  { idiom: "iphone", size: "20x20", scale: "2x", pixels: 40, filename: "Icon-20@2x.png" },
  { idiom: "iphone", size: "20x20", scale: "3x", pixels: 60, filename: "Icon-20@3x.png" },
  { idiom: "iphone", size: "29x29", scale: "2x", pixels: 58, filename: "Icon-29@2x.png" },
  { idiom: "iphone", size: "29x29", scale: "3x", pixels: 87, filename: "Icon-29@3x.png" },
  { idiom: "iphone", size: "40x40", scale: "2x", pixels: 80, filename: "Icon-40@2x.png" },
  { idiom: "iphone", size: "40x40", scale: "3x", pixels: 120, filename: "Icon-40@3x.png" },
  { idiom: "iphone", size: "60x60", scale: "2x", pixels: 120, filename: "Icon-60@2x.png" },
  { idiom: "iphone", size: "60x60", scale: "3x", pixels: 180, filename: "Icon-60@3x.png" },
  { idiom: "ios-marketing", size: "1024x1024", scale: "1x", pixels: 1024, filename: "Icon-1024.png" },
];

const colors = {
  blue: [37, 99, 235, 255],
  liftedBlue: [59, 130, 246, 255],
  deepBlue: [29, 78, 216, 255],
  white: [255, 255, 255, 255],
};

function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const spec of iconSpecs) {
    fs.writeFileSync(path.join(outputDir, spec.filename), makeIcon(spec.pixels));
  }

  fs.writeFileSync(
    path.join(outputDir, "Contents.json"),
    JSON.stringify(
      {
        images: iconSpecs.map(({ idiom, size, scale, filename }) => ({ idiom, size, scale, filename })),
        info: { author: "xcode", version: 1 },
      },
      null,
      2,
    ) + "\n",
  );
}

function makeIcon(size) {
  const scale = Math.max(3, Math.ceil(1024 / size));
  const canvas = new Canvas(size * scale, size * scale, colors.blue);
  const w = canvas.width;
  const h = canvas.height;
  const u = w / 1024;

  fillLinearGradient(canvas, colors.liftedBlue, colors.blue, colors.deepBlue);
  drawLine(canvas, [238 * u, 512 * u], [786 * u, 512 * u], 96 * u, colors.white);

  const output = new Canvas(size, size, [0, 0, 0, 0]);
  downsample(canvas, output, scale);
  return encodePng(output.width, output.height, output.pixels);
}

class Canvas {
  constructor(width, height, fill) {
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 4);
    for (let i = 0; i < this.pixels.length; i += 4) {
      this.pixels[i] = fill[0];
      this.pixels[i + 1] = fill[1];
      this.pixels[i + 2] = fill[2];
      this.pixels[i + 3] = fill[3];
    }
  }
}

function fillLinearGradient(canvas, startColor, midColor, endColor) {
  const denominator = Math.max(1, canvas.width + canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const t = (x + y) / denominator;
      const color = t < 0.62
        ? mixColor(startColor, midColor, t / 0.62)
        : mixColor(midColor, endColor, (t - 0.62) / 0.38);
      setPixel(canvas, x, y, color);
    }
  }
}

function drawLine(canvas, a, b, width, color) {
  const radius = width / 2;
  const minX = Math.floor(Math.min(a[0], b[0]) - radius);
  const maxX = Math.ceil(Math.max(a[0], b[0]) + radius);
  const minY = Math.floor(Math.min(a[1], b[1]) - radius);
  const maxY = Math.ceil(Math.max(a[1], b[1]) + radius);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy || 1;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSquared));
      const px = a[0] + t * dx;
      const py = a[1] + t * dy;
      if ((x - px) ** 2 + (y - py) ** 2 <= radius ** 2) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

function mixColor(a, b, t) {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * clamped),
    Math.round(a[1] + (b[1] - a[1]) * clamped),
    Math.round(a[2] + (b[2] - a[2]) * clamped),
    Math.round(a[3] + (b[3] - a[3]) * clamped),
  ];
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  canvas.pixels[i] = color[0];
  canvas.pixels[i + 1] = color[1];
  canvas.pixels[i + 2] = color[2];
  canvas.pixels[i + 3] = color[3];
}

function downsample(source, target, scale) {
  for (let y = 0; y < target.height; y++) {
    for (let x = 0; x < target.width; x++) {
      const total = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const i = (((y * scale + sy) * source.width) + (x * scale + sx)) * 4;
          total[0] += source.pixels[i];
          total[1] += source.pixels[i + 1];
          total[2] += source.pixels[i + 2];
          total[3] += source.pixels[i + 3];
        }
      }
      const count = scale * scale;
      const o = (y * target.width + x) * 4;
      target.pixels[o] = Math.round(total[0] / count);
      target.pixels[o + 1] = Math.round(total[1] / count);
      target.pixels[o + 2] = Math.round(total[2] / count);
      target.pixels[o + 3] = Math.round(total[3] / count);
    }
  }
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const input = (y * width + x) * 4;
      const output = rowStart + 1 + x * 3;
      raw[output] = rgba[input];
      raw[output + 1] = rgba[input + 1];
      raw[output + 2] = rgba[input + 2];
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 2, 0, 0, 0]),
    ])),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  return Buffer.concat([
    uint32(data.length),
    typeBuffer,
    data,
    uint32(crc32(Buffer.concat([typeBuffer, data]))),
  ]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

main();
