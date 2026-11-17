import {MAX_BYTES, MAX_PAGES, MAX_PIXELS, parsePages, filename, pageLayout, fileKind, readableSize} from './core.mjs';

const $ = id => document.getElementById(id);
const state = {mode: 'pdf', files: [], busy: false, outputs: [], zipUrl: null};
const scriptLoads = new Map();

function message(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}

function loadScript(path) {
  if (!scriptLoads.has(path)) scriptLoads.set(path, new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(path, import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => { script.remove(); scriptLoads.delete(path); reject(new Error('A conversion library could not load. Refresh the page and try again.')); };
    document.head.append(script);
  }));
  return scriptLoads.get(path);
}

function clearResults() {
  for (const output of state.outputs) URL.revokeObjectURL(output.url);
  if (state.zipUrl) URL.revokeObjectURL(state.zipUrl);
  state.zipUrl = null;
  state.outputs = [];
  $('result-grid').replaceChildren();
  $('results').hidden = true;
  $('download-zip').hidden = true;
  $('zip-link').hidden = true;
  $('zip-link').removeAttribute('href');
}

function setBusy(busy) {
  state.busy = busy;
  $('settings').disabled = busy;
  for (const id of ['pdf-mode', 'image-mode', 'drop-zone', 'file-input', 'clear-files']) $(id).disabled = busy;
  $('convert').disabled = busy || !state.files.length;
  $('convert').textContent = busy ? 'Converting…' : state.mode === 'pdf' ? 'Convert to images' : 'Create PDF';
  $('progress').hidden = !busy;
  $('progress').removeAttribute('value');
  renderFiles();
}

function smallButton(text, label, callback, disabled) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'file-control'; button.textContent = text;
  button.setAttribute('aria-label', label); button.disabled = state.busy || disabled;
  button.addEventListener('click', callback);
  return button;
}

function renderFiles() {
  $('file-list').replaceChildren();
  $('file-toolbar').hidden = !state.files.length;
  $('file-count').textContent = `${state.files.length} file${state.files.length === 1 ? '' : 's'} · ${readableSize(state.files.reduce((n, file) => n + file.size, 0))}`;
  state.files.forEach((file, i) => {
    const item = document.createElement('li'); item.className = 'file-item';
    const number = document.createElement('span'); number.className = 'file-number'; number.textContent = String(i + 1);
    const copy = document.createElement('div'); copy.className = 'file-description';
    const name = document.createElement('strong'); name.textContent = file.name;
    const size = document.createElement('small'); size.textContent = readableSize(file.size);
    copy.append(name, size);
    const actions = document.createElement('div'); actions.className = 'file-actions';
    const move = direction => {
      [state.files[i], state.files[i + direction]] = [state.files[i + direction], state.files[i]];
      clearResults(); renderFiles(); message('Image order updated. Ready to create your PDF.');
      const row = $('file-list').children[i + direction];
      row?.querySelector(direction < 0 ? 'button[aria-label^="Move up"]' : 'button[aria-label^="Move down"]')?.focus();
    };
    if (state.mode === 'image') actions.append(
      smallButton('↑', `Move up: ${file.name}`, () => move(-1), i === 0),
      smallButton('↓', `Move down: ${file.name}`, () => move(1), i === state.files.length - 1)
    );
    actions.append(smallButton('×', `Remove ${file.name}`, () => {
      state.files.splice(i, 1); clearResults(); renderFiles();
      $('convert').disabled = !state.files.length;
      message(state.files.length ? 'Ready to convert.' : 'Choose a file to get started.');
    }, false));
    item.append(number, copy, actions); $('file-list').append(item);
  });
}

function setMode(mode) {
  if (state.busy || state.mode === mode) return;
  state.mode = mode; state.files = []; clearResults();
  const pdf = mode === 'pdf';
  $('pdf-mode').setAttribute('aria-pressed', String(pdf));
  $('image-mode').setAttribute('aria-pressed', String(!pdf));
  $('pdf-options').hidden = !pdf; $('image-options').hidden = pdf;
  $('file-input').accept = pdf ? '.pdf,application/pdf' : '.png,.jpeg,.jpg,image/png,image/jpeg';
  $('file-input').multiple = !pdf; $('file-input').value = '';
  $('upload-heading').textContent = pdf ? '1. Choose your PDF' : '1. Choose your images';
  $('drop-title').textContent = pdf ? 'Drop a PDF here, or click to browse' : 'Drop images here, or click to browse';
  $('drop-hint').textContent = pdf ? 'One PDF, up to 150 MB' : 'PNG, JPG or JPEG · up to 100 images / 150 MB total';
  $('upload-hint').textContent = pdf ? 'Each selected page becomes a separate image. Download them individually or together as a ZIP.' : 'Add more images at any time. Use the arrows to arrange the pages before creating your PDF.';
  $('pdf-password').value = ''; $('page-range').value = '';
  message('Choose a file to get started.'); setBusy(false);
}

function addFiles(files) {
  if (state.busy || !files.length) return;
  const incoming = [...files];
  try {
    if (incoming.some(file => fileKind(file) !== state.mode)) throw new Error(state.mode === 'pdf' ? 'Choose a PDF file (.pdf).' : 'Choose PNG, JPG or JPEG images.');
    if (incoming.some(file => !file.size)) throw new Error('One of these files is empty. Choose a different file.');
    if (state.mode === 'pdf' && incoming.length !== 1) throw new Error('Choose one PDF at a time.');
    const combined = state.mode === 'pdf' ? incoming : [...state.files, ...incoming];
    const unique = combined.filter((file, index, all) => all.findIndex(other => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified) === index);
    if (unique.length > MAX_PAGES) throw new Error('Add up to 100 images at a time.');
    if (unique.reduce((sum, file) => sum + file.size, 0) > MAX_BYTES) throw new Error('Choose files totaling 150 MB or less.');
    state.files = unique; clearResults(); renderFiles(); $('convert').disabled = false;
    message(state.mode === 'pdf' ? 'PDF selected. Choose your settings, then convert.' : `${unique.length} image${unique.length === 1 ? '' : 's'} ready. Arrange them in your preferred page order.`);
  } catch (error) { message(error.message, true); }
  $('file-input').value = '';
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not export this image. Try a lower resolution.')), type, quality));
}

function addOutput(blob, name, preview = false) {
  const output = {blob, name, preview, url: URL.createObjectURL(blob)};
  state.outputs.push(output);
  return output;
}

function showResults() {
  for (const output of state.outputs) {
    const card = document.createElement('article'); card.className = 'result-card';
    if (output.preview) {
      const image = document.createElement('img'); image.src = output.url;
      image.alt = `Preview of ${output.name}`; image.loading = 'lazy'; card.append(image);
    }
    const title = document.createElement('strong'); title.textContent = output.name;
    const size = document.createElement('small'); size.textContent = readableSize(output.blob.size);
    const download = document.createElement('a'); download.className = 'converter-button';
    download.href = output.url; download.download = output.name; download.textContent = 'Download';
    download.setAttribute('aria-label', `Download ${output.name}`);
    card.append(title, size, download); $('result-grid').append(card);
  }
  $('results').hidden = false;
  $('download-zip').hidden = state.mode !== 'pdf' || state.outputs.length < 2;
}

async function pdfToImages() {
  message('Loading PDF…');
  let pdfjs;
  try { pdfjs = await import('./vendor/pdfjs/build/pdf.min.mjs'); }
  catch { throw new Error('The PDF reader could not load. Refresh the page and use a current browser.'); }
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/build/pdf.worker.min.mjs', import.meta.url).href;
  const assets = new URL('./vendor/pdfjs/', import.meta.url).href;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await state.files[0].arrayBuffer()), password: $('pdf-password').value,
    cMapUrl: assets + 'cmaps/', cMapPacked: true, standardFontDataUrl: assets + 'standard_fonts/',
    wasmUrl: assets + 'wasm/', iccUrl: assets + 'iccs/', isEvalSupported: false,
  });
  let canvas;
  try {
    const pdf = await task.promise;
    const pages = parsePages($('page-range').value, pdf.numPages);
    const format = $('image-format').value, type = format === 'png' ? 'image/png' : 'image/jpeg';
    const scale = Number($('resolution').value), quality = Number($('image-quality').value);
    $('progress').max = pages.length; $('progress').value = 0;
    let outputBytes = 0;
    for (const [index, number] of pages.entries()) {
      message(`Converting page ${number} · ${index + 1} of ${pages.length}…`);
      const page = await pdf.getPage(number), viewport = page.getViewport({scale});
      if (Math.ceil(viewport.width) * Math.ceil(viewport.height) > MAX_PIXELS || Math.max(viewport.width, viewport.height) > 8192) throw new Error(`Page ${number} is too large at this resolution. Choose a lower DPI setting.`);
      canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({canvasContext: canvas.getContext('2d'), viewport, background: '#ffffff'}).promise;
      const blob = await canvasBlob(canvas, type, quality);
      outputBytes += blob.size;
      if (outputBytes > MAX_BYTES * 2) throw new Error('The exported images are too large. Try fewer pages, a lower resolution, or JPEG.');
      addOutput(blob, `${filename(state.files[0].name)}-page-${String(number).padStart(String(pdf.numPages).length, '0')}.${format}`, true);
      canvas.width = canvas.height = 0; canvas = null; page.cleanup();
      $('progress').value = index + 1;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  } catch (error) {
    if (error.name === 'PasswordException') throw new Error('This PDF needs a password, or the password is incorrect. Enter it in the password field and try again.');
    if (error.name === 'InvalidPDFException') throw new Error('This file could not be read as a PDF. It may be damaged or use an unsupported format.');
    throw error;
  } finally {
    if (canvas) canvas.width = canvas.height = 0;
    await task.destroy();
  }
}

async function imageBytes(file) {
  const url = URL.createObjectURL(file), image = new Image();
  let canvas;
  try {
    image.src = url; await image.decode();
    const width = image.naturalWidth, height = image.naturalHeight;
    if (width * height > MAX_PIXELS || Math.max(width, height) > 16384) throw new Error(`${file.name} is too large. Use an image of 16 megapixels or less.`);
    // Browser decoding applies phone-camera orientation before drawing.
    canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const jpeg = /\.jpe?g$/i.test(file.name);
    const blob = await canvasBlob(canvas, jpeg ? 'image/jpeg' : 'image/png', .98);
    return {bytes: new Uint8Array(await blob.arrayBuffer()), jpeg, width, height};
  } catch (error) {
    if (error.name === 'EncodingError') throw new Error(`${file.name} could not be read as an image. Choose a valid PNG or JPEG file.`);
    throw error;
  } finally {
    URL.revokeObjectURL(url); image.src = '';
    if (canvas) canvas.width = canvas.height = 0;
  }
}

async function imagesToPdf() {
  message('Preparing your PDF…'); await loadScript('./vendor/pdf-lib.min.js');
  const pdf = await window.PDFLib.PDFDocument.create();
  pdf.setProducer('natestryker.com · PDF & Image Converter');
  $('progress').max = state.files.length; $('progress').value = 0;
  for (const [index, file] of state.files.entries()) {
    message(`Adding image ${index + 1} of ${state.files.length}…`);
    const image = await imageBytes(file);
    const embedded = image.jpeg ? await pdf.embedJpg(image.bytes) : await pdf.embedPng(image.bytes);
    const layout = pageLayout(image.width, image.height, $('page-size').value, $('orientation').value, Number($('margin').value));
    const page = pdf.addPage([layout.width, layout.height]);
    page.drawImage(embedded, {x: layout.x, y: layout.y, width: layout.imageWidth, height: layout.imageHeight});
    $('progress').value = index + 1;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  message('Saving your PDF…');
  addOutput(new Blob([await pdf.save()], {type: 'application/pdf'}), filename($('pdf-name').value, 'converted-images') + '.pdf');
}

$('pdf-mode').addEventListener('click', () => setMode('pdf'));
$('image-mode').addEventListener('click', () => setMode('image'));
$('drop-zone').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', event => addFiles(event.target.files));
$('drop-zone').addEventListener('dragover', event => { event.preventDefault(); if (!state.busy) $('drop-zone').classList.add('dragging'); });
$('drop-zone').addEventListener('dragleave', () => $('drop-zone').classList.remove('dragging'));
$('drop-zone').addEventListener('drop', event => { event.preventDefault(); $('drop-zone').classList.remove('dragging'); addFiles(event.dataTransfer.files); });
for (const type of ['dragover', 'drop']) window.addEventListener(type, event => { if ([...event.dataTransfer.types].includes('Files')) event.preventDefault(); });
$('clear-files').addEventListener('click', () => { state.files = []; clearResults(); renderFiles(); $('convert').disabled = true; message('Choose a file to get started.'); });
$('image-format').addEventListener('change', () => { $('quality-field').hidden = $('image-format').value === 'png'; });
$('page-size').addEventListener('change', () => { const fit = $('page-size').value === 'fit'; $('orientation-field').hidden = fit; $('margin-field').hidden = fit; });
$('convert').addEventListener('click', async () => {
  if (state.busy || !state.files.length) return;
  clearResults(); setBusy(true);
  try {
    if (state.mode === 'pdf') await pdfToImages(); else await imagesToPdf();
    showResults(); message(`${state.outputs.length} ${state.mode === 'pdf' ? 'image' + (state.outputs.length === 1 ? '' : 's') : 'PDF'} ready. Use the download buttons below.`);
  } catch (error) { clearResults(); message(error.message || 'Conversion failed. Try a smaller file.', true); }
  finally { setBusy(false); }
});
$('download-zip').addEventListener('click', async () => {
  if (state.busy || !state.outputs.length) return;
  setBusy(true); $('download-zip').disabled = true; message('Preparing ZIP download…');
  try {
    await loadScript('./vendor/fflate.js');
    const entries = {};
    for (const output of state.outputs) entries[output.name] = new Uint8Array(await output.blob.arrayBuffer());
    const zipped = await new Promise((resolve, reject) => window.fflate.zip(entries, {level: 0}, (error, data) => error ? reject(error) : resolve(data)));
    const blob = new Blob([zipped], {type: 'application/zip'}), url = URL.createObjectURL(blob);
    // A real link remains available if the browser blocks an automatic download.
    const link = $('zip-link'); link.href = url; link.download = filename(state.files[0].name) + '-images.zip';
    state.zipUrl = url; link.hidden = false; $('download-zip').hidden = true; link.click();
    message('ZIP ready. You can also download each image individually.');
  } catch (error) { message(error.message || 'Could not create the ZIP. Download the individual images below.', true); }
  finally { setBusy(false); if ($('download-zip')) $('download-zip').disabled = false; }
});
window.addEventListener('pagehide', event => { if (!event.persisted) clearResults(); });
