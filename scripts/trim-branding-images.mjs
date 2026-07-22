import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const brandingDir = path.resolve("desktop/renderer/public/branding");
const buildIcon = path.resolve("build/icon.png");

function isSeparatorRow(png, row) {
  const { width, data } = png;
  let opaque = 0;
  let dark = 0;
  let light = 0;

  for (let x = 0; x < width; x++) {
    const i = (width * row + x) * 4;
    const alpha = data[i + 3];

    if (alpha < 12) {
      continue;
    }

    opaque++;

    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];

    if (red < 100 && green < 100 && blue < 100) {
      dark++;
    } else if (red > 210 && green > 210 && blue > 210) {
      light++;
    }
  }

  if (opaque === 0) {
    return true;
  }

  if (dark / width > 0.2 && light / width < 0.05) {
    return true;
  }

  return false;
}

function trimBottom(png, { maxSeparatorRows = 20 } = {}) {
  let bottom = png.height;
  let separatorRows = 0;

  while (bottom > 1) {
    const row = bottom - 1;

    if (isSeparatorRow(png, row)) {
      separatorRows++;

      if (separatorRows > maxSeparatorRows) {
        break;
      }

      bottom--;
      continue;
    }

    break;
  }

  if (bottom === png.height) {
    return null;
  }

  const trimmed = new PNG({ width: png.width, height: bottom });

  for (let row = 0; row < bottom; row++) {
    png.data.copy(
      trimmed.data,
      row * png.width * 4,
      row * png.width * 4,
      (row + 1) * png.width * 4,
    );
  }

  return trimmed;
}

function trimFile(filePath) {
  const png = PNG.sync.read(fs.readFileSync(filePath));
  const fileName = path.basename(filePath).toLowerCase();
  const options = fileName.includes("icon")
    ? { maxSeparatorRows: 0 }
    : { maxSeparatorRows: 24 };

  const trimmed = trimBottom(png, options);

  if (!trimmed) {
    console.log(`[trim] ${filePath}: no bottom trim needed`);

    return;
  }

  const removed = png.height - trimmed.height;

  fs.writeFileSync(filePath, PNG.sync.write(trimmed));
  console.log(`[trim] ${filePath}: removed ${removed}px from bottom (${png.height} -> ${trimmed.height})`);
}

for (const fileName of fs.readdirSync(brandingDir)) {
  if (!fileName.endsWith(".png")) {
    continue;
  }

  trimFile(path.join(brandingDir, fileName));
}

if (fs.existsSync(buildIcon)) {
  trimFile(buildIcon);
}
