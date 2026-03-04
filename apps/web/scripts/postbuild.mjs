import { mkdir, copyFile, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.cwd(), 'dist');

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensurePrettyRoute(route, htmlFile) {
  const src = path.join(dist, htmlFile);
  const dir = path.join(dist, route);
  const dst = path.join(dir, 'index.html');

  if (!(await exists(src))) {
    throw new Error(`postbuild: missing ${src}`);
  }

  await mkdir(dir, { recursive: true });
  await copyFile(src, dst);
}

// Cloudflare Pages “pretty URLs” will commonly canonicalize to /path (or /path/).
// To avoid edge redirect loops, we provide real directories with index.html.
await ensurePrettyRoute('play', 'play.html');
await ensurePrettyRoute('how-to-play', 'how-to-play.html');
await ensurePrettyRoute('tips', 'tips.html');
await ensurePrettyRoute('updates', 'updates.html');

// Optional: keep output tidy if desired (leave the .html files for direct access + debugging)
// If you want to remove them, uncomment:
// await rm(path.join(dist, 'play.html'));
