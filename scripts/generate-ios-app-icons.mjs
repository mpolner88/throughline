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
  background: [248, 250, 252, 255],
  ink: [15, 23, 42, 255],
  blue: [37, 99, 235, 255],
  liftedBlue: [59, 130, 246, 255],
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
  const canvas = new Canvas(size * scale, size * scale, colors.background);
  const w = canvas.width;
  const h = canvas.height;
  const u = w / 1024;

  roundRect(canvas, 0, 0, w, h, 220 * u, colors.background);
  roundRect(canvas, 0, 650 * u, w, 374 * u, 0, colors.blue);

  const stroke = Math.max(8 * u, 92 * u);
  drawPolyline(canvas, [
    [150 * u, 472 * u],
    [388 * u, 472 * u],
  ], stroke, colors.blue);
  drawCubic(canvas, [388 * u, 472 * u], [388 * u, 302 * u], [525 * u, 170 * u], [688 * u, 208 * u], stroke, colors.blue);
  drawCubic(canvas, [688 * u, 208 * u], [848 * u, 246 * u], [884 * u, 444 * u], [760 * u, 556 * u], stroke, colors.blue);
  drawCubic(canvas, [760 * u, 556 * u], [625 * u, 678 * u], [388 * u, 610 * u], [388 * u, 472 * u], stroke, colors.blue);
  drawPolyline(canvas, [
    [388 * u, 472 * u],
    [874 * u, 472 * u],
  ], stroke, colors.blue);

  drawPolyline(canvas, [
    [152 * u, 768 * u],
    [410 * u, 768 * u],
  ], stroke * 0.8, colors.white);
  drawCubic(canvas, [410 * u, 768 * u], [530 * u, 646 * u], [688 * u, 646 * u], [806 * u, 768 * u], stroke * 0.8, colors.white);
  drawPolyline(canvas, [
    [806 * u, 768 * u],
    [874 * u, 768 * u],
  ], stroke * 0.8, colors.white);

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

function roundRect(canvas, x, y, width, height, radius, color) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(canvas.width, Math.ceil(x + width));
  const y1 = Math.min(canvas.height, Math.ceil(y + height));
  const r = Math.max(0, radius);

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const cx = px < x + r ? x + r : px >= x + width - r ? x + width - r : px;
      const cy = py < y + r ? y + r : py >= y + height - r ? y + height - r : py;
      const inside = r === 0 || (px - cx) ** 2 + (py - cy) ** 2 <= r ** 2;
      if (inside) setPixel(canvas, px, py, color);
    }
  }
}

function drawPolyline(canvas, points, width, color) {
  for (let i = 0; i < points.length - 1; i++) {
    drawLine(canvas, points[i], points[i + 1], width, color);
  }
}

function drawCubic(canvas, p0, p1, p2, p3, width, color) {
  const steps = 180;
  let previous = p0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const point = [
      cubic(p0[0], p1[0], p2[0], p3[0], t),
      cubic(p0[1], p1[1], p2[1], p3[1], t),
    ];
    drawLine(canvas, previous, point, width, color);
    previous = point;
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

function cubic(a, b, c, d, t) {
  const mt = 1 - t;
  return mt ** 3 * a + 3 * mt ** 2 * t * b + 3 * mt * t ** 2 * c + t ** 3 * d;
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
