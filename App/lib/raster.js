function inferSuitFromRegion(ctx, x, y, w, h) {
  x = Math.max(0, Math.floor(x));
  y = Math.max(0, Math.floor(y));
  w = Math.max(2, Math.floor(w));
  h = Math.max(2, Math.floor(h));

  const image = ctx.getImageData(x, y, w, h);
  const { data } = image;
  const mask = new Uint8Array(w * h);
  let redPixels = 0;
  let inkPixels = 0;

  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const i = (py * w + px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const red = r > 120 && r > g * 1.25 && r > b * 1.25;
      const dark = r < 170 && g < 170 && b < 170;

      if (red || dark) {
        mask[py * w + px] = 1;
        inkPixels += 1;
        if (red) redPixels += 1;
      }
    }
  }

  if (inkPixels < 8) return '?';

  const comps = smallComponents(mask, w, h)
    .filter(c => c.area >= 4 && c.h >= 4 && c.w >= 3 && c.w / c.h < 3)
    .sort((a, b) => b.area - a.area);

  if (!comps.length) return '?';

  const c = comps[0];
  const normalizedRows = new Array(32).fill(0);

  for (let ny = 0; ny < 32; ny += 1) {
    const sy = Math.min(c.h - 1, Math.floor(ny * c.h / 32));
    let count = 0;

    for (let nx = 0; nx < 32; nx += 1) {
      const sx = Math.min(c.w - 1, Math.floor(nx * c.w / 32));
      const srcX = c.x + sx;
      const srcY = c.y + sy;
      if (mask[srcY * w + srcX]) count += 1;
    }

    normalizedRows[ny] = count;
  }

  const avg = arr => arr.reduce((sum, n) => sum + n, 0) / Math.max(1, arr.length);
  const redRatio = redPixels / inkPixels;

  if (redRatio > 0.5) {
    const firstEight = avg(normalizedRows.slice(0, 8));
    return firstEight > 12 ? '♥' : '♦';
  }

  const topHalfMax = Math.max(...normalizedRows.slice(0, 16));
  return topHalfMax >= 27 ? '♠' : '♣';
}

function smallComponents(mask, w, h) {
  const components = [];
  const queue = new Int32Array(w * h);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const start = y * w + x;
      if (mask[start] !== 1) continue;

      let head = 0, tail = 0;
      queue[tail++] = start;
      mask[start] = 2;

      let minX = x, maxX = x, minY = y, maxY = y, area = 0;

      while (head < tail) {
        const idx = queue[head++];
        const px = idx % w;
        const py = Math.floor(idx / w);
        area += 1;

        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);

        const neighbors = [idx - 1, idx + 1, idx - w, idx + w];
        for (const next of neighbors) {
          if (next < 0 || next >= mask.length || mask[next] !== 1) continue;
          const nx = next % w;
          const ny = Math.floor(next / w);
          if (Math.abs(nx - px) + Math.abs(ny - py) !== 1) continue;
          mask[next] = 2;
          queue[tail++] = next;
        }
      }

      components.push({
        x: minX, y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        area
      });
    }
  }

  return components;
}

function countHoles(mask, w, h) {
  const background = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i += 1) background[i] = mask[i] ? 0 : 1;

  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;

  function enqueue(index) {
    if (index >= 0 && index < background.length && background[index] === 1) {
      background[index] = 2;
      queue[tail++] = index;
    }
  }

  for (let x = 0; x < w; x += 1) {
    enqueue(x);
    enqueue((h - 1) * w + x);
  }
  for (let y = 0; y < h; y += 1) {
    enqueue(y * w);
    enqueue(y * w + (w - 1));
  }

  while (head < tail) {
    const idx = queue[head++];
    const px = idx % w;
    const py = Math.floor(idx / w);
    const neighbors = [idx - 1, idx + 1, idx - w, idx + w];

    for (const next of neighbors) {
      if (next < 0 || next >= background.length || background[next] !== 1) continue;
      const nx = next % w;
      const ny = Math.floor(next / w);
      if (Math.abs(nx - px) + Math.abs(ny - py) !== 1) continue;
      background[next] = 2;
      queue[tail++] = next;
    }
  }

  let holes = 0;
  for (let i = 0; i < background.length; i += 1) {
    if (background[i] !== 1) continue;
    holes += 1;
    head = 0; tail = 0;
    background[i] = 3;
    queue[tail++] = i;

    while (head < tail) {
      const idx = queue[head++];
      const px = idx % w;
      const py = Math.floor(idx / w);
      const neighbors = [idx - 1, idx + 1, idx - w, idx + w];

      for (const next of neighbors) {
        if (next < 0 || next >= background.length || background[next] !== 1) continue;
        const nx = next % w;
        const ny = Math.floor(next / w);
        if (Math.abs(nx - px) + Math.abs(ny - py) !== 1) continue;
        background[next] = 3;
        queue[tail++] = next;
      }
    }
  }

  return holes;
}

function makeGlyphDataUrl(ctx, rect) {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const w = Math.max(3, Math.floor(rect.w));
  const h = Math.max(3, Math.floor(rect.h));

  const image = ctx.getImageData(x, y, w, h);
  const data = image.data;
  const mask = new Uint8Array(w * h);

  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const i = (py * w + px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const red = r > 115 && r > g * 1.20 && r > b * 1.20;
      const dark = r < 185 && g < 185 && b < 185;
      if (red || dark) mask[py * w + px] = 1;
    }
  }

  const components = smallComponents(mask.slice(), w, h)
    .filter(c => c.area >= 3 && c.h >= Math.max(4, h * 0.25) && c.w >= 1 && c.w / c.h < 3.5);

  if (!components.length) return null;

  const minX = Math.min(...components.map(c => c.x));
  const minY = Math.min(...components.map(c => c.y));
  const maxX = Math.max(...components.map(c => c.x + c.w));
  const maxY = Math.max(...components.map(c => c.y + c.h));

  const glyphW = Math.max(1, maxX - minX);
  const glyphH = Math.max(1, maxY - minY);
  const padded = document.createElement('canvas');
  padded.width = 120;
  padded.height = 120;
  const pctx = padded.getContext('2d');
  pctx.fillStyle = '#fff';
  pctx.fillRect(0, 0, 120, 120);

  const source = document.createElement('canvas');
  source.width = w;
  source.height = h;
  source.getContext('2d').putImageData(image, 0, 0);

  const scale = Math.min(75 / glyphW, 90 / glyphH);
  const drawW = glyphW * scale;
  const drawH = glyphH * scale;

  pctx.imageSmoothingEnabled = true;
  pctx.drawImage(
    source,
    minX, minY, glyphW, glyphH,
    (120 - drawW) / 2, (120 - drawH) / 2, drawW, drawH
  );

  const tightMask = new Uint8Array(glyphW * glyphH);
  for (let py = 0; py < glyphH; py += 1) {
    for (let px = 0; px < glyphW; px += 1) {
      tightMask[py * glyphW + px] = mask[(minY + py) * w + (minX + px)];
    }
  }

  return {
    dataUrl: padded.toDataURL('image/png'),
    holes: countHoles(tightMask, glyphW, glyphH)
  };
}

