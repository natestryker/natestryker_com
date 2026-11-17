import {filename, readableSize} from '../pdf-image-converter/core.mjs';

const $ = id => document.getElementById(id);
const MAX_BYTES = 100 * 1024 * 1024, MAX_SECONDS = 20 * 60;
let file = null, busy = false, worker = null, resultUrl = null, run = 0, cancelEncoding = null;

function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }

function clearResult() {
  $('audio-preview').pause(); $('audio-preview').removeAttribute('src'); $('audio-preview').load();
  $('download').removeAttribute('href'); $('results').hidden = true;
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
}

function setBusy(value) {
  busy = value;
  for (const id of ['drop-zone', 'file-input', 'clear-file', 'settings']) $(id).disabled = value;
  $('convert').disabled = value || !file;
  $('convert').textContent = value ? 'Converting…' : 'Convert to MP3';
  $('cancel').hidden = !value;
  $('progress').hidden = !value; $('progress').removeAttribute('value');
}

function selectFile(files) {
  if (busy || !files.length) return;
  files = [...files]; $('file-input').value = '';
  if (files.length !== 1) { message('Choose one MP4 video at a time.', true); return; }
  const next = files[0];
  if (!/\.mp4$/i.test(next.name)) { message('Choose an MP4 file (.mp4).', true); return; }
  if (!next.size || next.size > MAX_BYTES) { message('Choose a non-empty MP4 file of 100 MB or less.', true); return; }
  file = next; clearResult();
  $('file-name').textContent = file.name; $('file-details').textContent = readableSize(file.size);
  $('output-name').value = filename(file.name, 'converted-audio');
  $('file-toolbar').hidden = false; $('selected-file').hidden = false;
  $('convert').disabled = false; $('file-input').value = '';
  message('Video selected. Choose your audio quality, then convert.');
}

async function videoDuration(file) {
  const url = URL.createObjectURL(file), video = document.createElement('video');
  video.preload = 'metadata';
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('This video could not be read. Try a different MP4 file.')), 15000);
      video.onloadedmetadata = () => { clearTimeout(timer); resolve(video.duration); };
      video.onerror = () => { clearTimeout(timer); reject(new Error('This MP4 could not be read by your browser. Try a different file or a current browser.')); };
      video.src = url;
    });
  } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}

function encode(channels, sampleRate, bitrate) {
  return new Promise((resolve, reject) => {
    worker = new Worker(new URL('./encoder-worker.js', import.meta.url));
    const finish = () => { worker?.terminate(); worker = null; cancelEncoding = null; };
    cancelEncoding = () => { finish(); reject(new DOMException('Conversion canceled.', 'AbortError')); };
    worker.onerror = () => { finish(); reject(new Error('The MP3 encoder could not start. Refresh this page and try again.')); };
    worker.onmessage = event => {
      const data = event.data;
      if (data.type === 'progress') { $('progress').value = data.progress; message(`Encoding MP3 · ${data.progress}%…`); }
      if (data.type === 'done') { finish(); resolve(new Blob(data.chunks, {type: 'audio/mpeg'})); }
      if (data.type === 'error') { finish(); reject(new Error(data.message)); }
    };
    const buffers = channels.map(channel => channel.buffer);
    worker.postMessage({channels: buffers, sampleRate, bitrate}, buffers);
  });
}

$('drop-zone').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', event => selectFile(event.target.files));
$('drop-zone').addEventListener('dragover', event => { event.preventDefault(); if (!busy) $('drop-zone').classList.add('dragging'); });
$('drop-zone').addEventListener('dragleave', () => $('drop-zone').classList.remove('dragging'));
$('drop-zone').addEventListener('drop', event => { event.preventDefault(); $('drop-zone').classList.remove('dragging'); selectFile(event.dataTransfer.files); });
for (const type of ['dragover', 'drop']) window.addEventListener(type, event => { if ([...event.dataTransfer.types].includes('Files')) event.preventDefault(); });
$('clear-file').addEventListener('click', () => {
  file = null; clearResult(); $('file-toolbar').hidden = true; $('selected-file').hidden = true;
  $('file-input').value = ''; $('convert').disabled = true; message('Choose a video to get started.');
});
$('cancel').addEventListener('click', () => {
  // Browser audio decoding cannot be interrupted; keep the controls locked until
  // it releases its buffer. Worker encoding can be terminated immediately.
  run++; $('cancel').disabled = true;
  if (cancelEncoding) cancelEncoding();
  message('Canceling conversion…');
});
$('convert').addEventListener('click', async () => {
  if (busy || !file) return;
  const currentRun = ++run, bitrate = Number($('bitrate').value), name = filename($('output-name').value, 'converted-audio') + '.mp3';
  clearResult(); setBusy(true); $('cancel').disabled = false;
  const active = () => { if (currentRun !== run) throw new DOMException('Conversion canceled.', 'AbortError'); };
  try {
    message('Reading video…');
    const duration = await videoDuration(file); active();
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_SECONDS) throw new Error('Choose a video up to 20 minutes long. Trim longer videos before converting.');
    message('Decoding audio… This can take a moment.');
    const Context = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Context) throw new Error('Your browser does not support local audio conversion. Try a current Chrome, Edge, Firefox or Safari.');
    let audio;
    try { audio = await new Context(2, 1, 44100).decodeAudioData(await file.arrayBuffer()); }
    catch { throw new Error('No readable audio track was found. The MP4 may be silent or use a codec your browser cannot decode. Try an MP4 with AAC audio.'); }
    active();
    if (audio.duration > MAX_SECONDS) throw new Error('The audio track is longer than 20 minutes. Trim the video before converting.');
    const channelCount = Math.min(2, audio.numberOfChannels), sampleRate = audio.sampleRate;
    if (audio.numberOfChannels > 2) {
      const mixer = new Context(2, audio.length, sampleRate), source = mixer.createBufferSource();
      source.buffer = audio; source.connect(mixer.destination); source.start();
      audio = await mixer.startRendering(); active();
    }
    const channels = Array.from({length: channelCount}, (_, i) => audio.getChannelData(i).slice());
    const seconds = audio.duration; audio = null;
    $('progress').max = 100; $('progress').value = 0; message('Encoding MP3…');
    const blob = await encode(channels, sampleRate, bitrate); active();
    resultUrl = URL.createObjectURL(blob);
    $('result-name').textContent = name;
    $('result-details').textContent = `${readableSize(blob.size)} · ${bitrate} kbps · ${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
    $('audio-preview').src = resultUrl; $('download').href = resultUrl; $('download').download = name;
    $('results').hidden = false; message('Your MP3 is ready. Preview it or download it below.');
  } catch (error) {
    message(error.name === 'AbortError' ? 'Conversion canceled. Your video is ready to try again.' : error.message || 'Conversion failed. Try a shorter video.', error.name !== 'AbortError');
  } finally { worker?.terminate(); worker = null; cancelEncoding = null; setBusy(false); }
});
window.addEventListener('pagehide', event => { if (!event.persisted) { worker?.terminate(); if (resultUrl) URL.revokeObjectURL(resultUrl); } });
