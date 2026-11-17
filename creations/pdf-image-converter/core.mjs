export const MAX_BYTES = 150 * 1024 * 1024;
export const MAX_PAGES = 100;
export const MAX_PIXELS = 16_000_000;

export function parsePages(value, total) {
  if (!Number.isInteger(total) || total < 1) throw new Error('This PDF has no pages.');
  const input = value.trim();
  if (!input) {
    if (total > MAX_PAGES) throw new Error('Choose a range of up to 100 pages from this PDF.');
    return Array.from({length: total}, (_, i) => i + 1);
  }
  const pages = new Set();
  for (const part of input.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Enter pages like 1, 3-5, using commas and hyphens.');
    const start = Number(match[1]), end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > total) throw new Error(`Page numbers must be between 1 and ${total}, with ranges in ascending order.`);
    if (end - start + 1 > MAX_PAGES) throw new Error('Choose up to 100 pages per conversion.');
    for (let i = start; i <= end; i++) pages.add(i);
    if (pages.size > MAX_PAGES) throw new Error('Choose up to 100 pages per conversion.');
  }
  return [...pages].sort((a, b) => a - b);
}

export function filename(value, fallback = 'converted') {
  return value.replace(/\.(pdf|png|jpe?g|mp3|mp4)$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/, '').trim().slice(0, 100) || fallback;
}

export function pageLayout(width, height, size, orientation, margin) {
  if (!(width > 0 && height > 0)) throw new Error('This image has invalid dimensions.');
  if (size === 'fit') return {width: width * .75, height: height * .75, x: 0, y: 0, imageWidth: width * .75, imageHeight: height * .75};
  let [pageWidth, pageHeight] = size === 'letter' ? [612, 792] : [595.28, 841.89];
  if (orientation === 'landscape' || (orientation === 'auto' && width > height)) [pageWidth, pageHeight] = [pageHeight, pageWidth];
  const scale = Math.min((pageWidth - margin * 2) / width, (pageHeight - margin * 2) / height);
  return {width: pageWidth, height: pageHeight, x: (pageWidth - width * scale) / 2, y: (pageHeight - height * scale) / 2, imageWidth: width * scale, imageHeight: height * scale};
}

export function fileKind(file) {
  if (/\.pdf$/i.test(file.name)) return 'pdf';
  if (/\.(png|jpe?g)$/i.test(file.name)) return 'image';
  return null;
}

export function readableSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
