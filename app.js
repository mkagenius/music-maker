const STORAGE_KEY = "pulse-grid-song-v1";
const DRUM_LANES = ["kick", "snare", "hat"];
const DEFAULT_ROWS = [
  { note: "E5", color: "#ef5c70" },
  { note: "D5", color: "#ff8666" },
  { note: "C5", color: "#ffb347" },
  { note: "A4", color: "#e3d93f" },
  { note: "G4", color: "#96c63b" },
  { note: "E4", color: "#1eb787" },
  { note: "D4", color: "#18a3d7" },
  { note: "C4", color: "#6982f5" },
];

const DEMO_SONG = {
  title: "Glass Arcade",
  tempo: 120,
  steps: 8,
  rows: DEFAULT_ROWS,
  notes: [
    { step: 0, note: "G4", length: 2 },
    { step: 1, note: "D4", length: 2 },
    { step: 2, note: "A4", length: 2 },
    { step: 3, note: "D4", length: 1 },
    { step: 4, note: "G4", length: 2 },
    { step: 5, note: "D4", length: 2 },
    { step: 6, note: "C5", length: 2 },
    { step: 7, note: "D4", length: 1 },
  ],
  drums: [
    { step: 2, lane: "kick" },
    { step: 4, lane: "kick" },
    { step: 6, lane: "kick" },
    { step: 1, lane: "hat" },
    { step: 3, lane: "hat" },
    { step: 5, lane: "hat" },
    { step: 7, lane: "hat" },
    { step: 4, lane: "snare" },
  ],
};

const state = {
  song: loadSavedSong(),
  isPlaying: false,
  isRecording: false,
  currentStep: 0,
  timerId: null,
  audioContext: null,
  masterGain: null,
  noiseBuffer: null,
  mediaStreamDestination: null,
  mediaRecorder: null,
  recordedChunks: [],
  recordingMimeType: "",
  recordingUrl: null,
};

const elements = {
  songTitle: document.querySelector("#songTitle"),
  tempoBadge: document.querySelector("#tempoBadge"),
  stepsBadge: document.querySelector("#stepsBadge"),
  stepMarkers: document.querySelector("#stepMarkers"),
  rowLabels: document.querySelector("#rowLabels"),
  melodyCells: document.querySelector("#melodyCells"),
  melodyNotes: document.querySelector("#melodyNotes"),
  playhead: document.querySelector("#playhead"),
  drumLabels: document.querySelector("#drumLabels"),
  drumCells: document.querySelector("#drumCells"),
  tempoSlider: document.querySelector("#tempoSlider"),
  lengthSelect: document.querySelector("#lengthSelect"),
  fileInput: document.querySelector("#fileInput"),
  playButton: document.querySelector("#playButton"),
  stopButton: document.querySelector("#stopButton"),
  recordButton: document.querySelector("#recordButton"),
  stopRecordButton: document.querySelector("#stopRecordButton"),
  loadDemoButton: document.querySelector("#loadDemoButton"),
  exportButton: document.querySelector("#exportButton"),
  statusMessage: document.querySelector("#statusMessage"),
  recordingBadge: document.querySelector("#recordingBadge"),
  recordingLink: document.querySelector("#recordingLink"),
  jsonInput: document.querySelector("#jsonInput"),
  applyButton: document.querySelector("#applyButton"),
  formatButton: document.querySelector("#formatButton"),
  copyButton: document.querySelector("#copyButton"),
};

boot();

function boot() {
  syncFormToSong();
  renderSong();
  syncTransportState();
  wireEvents();
  window.addEventListener("beforeunload", cleanupRecordingUrl);
}

function wireEvents() {
  elements.playButton.addEventListener("click", togglePlayback);
  elements.stopButton.addEventListener("click", () => {
    if (state.isRecording) {
      stopRecording();
      return;
    }
    stopPlayback();
  });
  elements.recordButton.addEventListener("click", startRecording);
  elements.stopRecordButton.addEventListener("click", stopRecording);
  elements.loadDemoButton.addEventListener("click", () => {
    loadSong(DEMO_SONG, "Demo loaded.");
  });
  elements.exportButton.addEventListener("click", exportSong);

  elements.applyButton.addEventListener("click", () => {
    tryLoadJson(elements.jsonInput.value, "JSON applied.");
  });

  elements.formatButton.addEventListener("click", () => {
    syncJsonEditor();
    setStatus("JSON formatted from the current grid.");
  });

  elements.copyButton.addEventListener("click", async () => {
    syncJsonEditor();
    try {
      await navigator.clipboard.writeText(elements.jsonInput.value);
      setStatus("JSON copied to clipboard.");
    } catch (error) {
      setStatus("Clipboard access failed. You can still copy from the editor.", true);
    }
  });

  elements.tempoSlider.addEventListener("input", (event) => {
    state.song.tempo = clampNumber(Number(event.target.value), 70, 180, 120);
    persistSong();
    syncFormToSong();
    syncJsonEditor();
    if (state.isPlaying) {
      restartPlaybackFromCurrentStep();
    }
  });

  elements.fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files ?? [];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      tryLoadJson(text, `Loaded ${file.name}.`);
    } catch (error) {
      setStatus("That file could not be read.", true);
    } finally {
      event.target.value = "";
    }
  });

  window.addEventListener("resize", () => {
    renderMelodyNotes();
    updatePlayhead();
  });
}

function renderSong() {
  const { song } = state;
  const steps = song.steps;
  const rows = song.rows.length;

  document.documentElement.style.setProperty("--steps", String(steps));
  document.documentElement.style.setProperty("--rows", String(rows));
  document.documentElement.style.setProperty("--drums", String(DRUM_LANES.length));

  elements.songTitle.textContent = song.title;
  elements.tempoBadge.textContent = `${song.tempo} BPM`;
  elements.stepsBadge.textContent = `${song.steps} steps`;

  renderStepMarkers();
  renderRowLabels();
  renderMelodyCells();
  renderMelodyNotes();
  renderDrumLabels();
  renderDrumCells();
  updatePlayhead();
}

function renderStepMarkers() {
  elements.stepMarkers.textContent = "";
  for (let step = 0; step < state.song.steps; step += 1) {
    const marker = document.createElement("div");
    marker.className = "step-marker";
    marker.textContent = String(step + 1);
    elements.stepMarkers.appendChild(marker);
  }
}

function renderRowLabels() {
  elements.rowLabels.textContent = "";
  state.song.rows.forEach((row) => {
    const label = document.createElement("div");
    label.className = "row-label";
    label.textContent = row.note;
    label.style.boxShadow = `inset 4px 0 0 ${row.color}`;
    elements.rowLabels.appendChild(label);
  });
}

function renderMelodyCells() {
  elements.melodyCells.textContent = "";
  for (let row = 0; row < state.song.rows.length; row += 1) {
    for (let step = 0; step < state.song.steps; step += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "melody-cell";
      cell.dataset.row = String(row);
      cell.dataset.step = String(step);
      cell.setAttribute(
        "aria-label",
        `Toggle note on ${state.song.rows[row].note} at step ${step + 1}`,
      );
      cell.addEventListener("click", () => {
        toggleMelodyNote(row, step);
      });
      elements.melodyCells.appendChild(cell);
    }
  }
}

function renderMelodyNotes() {
  elements.melodyNotes.textContent = "";
  const { gap, cellHeight, cellWidth } = getGridMetrics();

  state.song.notes.forEach((note) => {
    const block = document.createElement("div");
    const row = resolveRowIndex(note);
    const rowConfig = state.song.rows[row];
    const left = note.step * (cellWidth + gap);
    const top = row * (cellHeight + gap);
    const width = note.length * cellWidth + Math.max(note.length - 1, 0) * gap;

    block.className = "note-block";
    block.style.left = `${left}px`;
    block.style.top = `${top}px`;
    block.style.width = `${width}px`;
    block.style.height = `${cellHeight}px`;
    block.style.background = `${rowConfig.color}dd`;
    block.textContent = rowConfig.note;
    elements.melodyNotes.appendChild(block);
  });
}

function renderDrumLabels() {
  elements.drumLabels.textContent = "";
  DRUM_LANES.forEach((lane) => {
    const label = document.createElement("div");
    label.className = "drum-label";
    label.textContent = lane;
    elements.drumLabels.appendChild(label);
  });
}

function renderDrumCells() {
  elements.drumCells.textContent = "";
  for (let laneIndex = 0; laneIndex < DRUM_LANES.length; laneIndex += 1) {
    const lane = DRUM_LANES[laneIndex];
    for (let step = 0; step < state.song.steps; step += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "drum-cell";
      cell.dataset.lane = lane;
      cell.dataset.step = String(step);
      if (hasDrumHit(step, lane)) {
        cell.classList.add("is-active");
      }
      cell.setAttribute("aria-label", `Toggle ${lane} at step ${step + 1}`);
      cell.addEventListener("click", () => {
        toggleDrum(step, lane);
      });
      elements.drumCells.appendChild(cell);
    }
  }
}

function syncFormToSong() {
  elements.tempoSlider.value = String(state.song.tempo);
  syncJsonEditor();
}

function syncJsonEditor() {
  elements.jsonInput.value = JSON.stringify(state.song, null, 2);
}

function toggleMelodyNote(row, step) {
  if (state.isRecording) {
    return;
  }

  const noteIndex = state.song.notes.findIndex((note) => {
    if (resolveRowIndex(note) !== row) {
      return false;
    }
    return step >= note.step && step < note.step + note.length;
  });

  if (noteIndex >= 0) {
    state.song.notes.splice(noteIndex, 1);
    afterSongMutation("Note removed.");
    return;
  }

  const length = clampNumber(
    Number(elements.lengthSelect.value),
    1,
    Math.max(1, state.song.steps - step),
    2,
  );
  const maxLength = Math.min(length, state.song.steps - step);

  state.song.notes = state.song.notes.filter((note) => {
    if (resolveRowIndex(note) !== row) {
      return true;
    }
    const noteEnd = note.step + note.length;
    const newEnd = step + maxLength;
    return noteEnd <= step || note.step >= newEnd;
  });

  state.song.notes.push({
    step,
    note: state.song.rows[row].note,
    length: maxLength,
  });
  sortNotes();
  afterSongMutation("Note added.");
}

function toggleDrum(step, lane) {
  if (state.isRecording) {
    return;
  }

  const existingIndex = state.song.drums.findIndex(
    (hit) => hit.step === step && hit.lane === lane,
  );

  if (existingIndex >= 0) {
    state.song.drums.splice(existingIndex, 1);
    afterSongMutation("Drum hit removed.");
    return;
  }

  state.song.drums.push({ step, lane });
  sortDrums();
  afterSongMutation("Drum hit added.");
}

function afterSongMutation(message) {
  persistSong();
  renderSong();
  syncJsonEditor();
  setStatus(message);
}

function togglePlayback() {
  if (state.isRecording) {
    return;
  }

  if (state.isPlaying) {
    pausePlayback();
    return;
  }
  startPlayback();
}

async function startPlayback(options = {}) {
  const { resetStep = false, announce = true } = options;

  ensureAudio();
  if (!state.audioContext) {
    setStatus("Audio is not available in this browser.", true);
    return false;
  }

  try {
    if (state.audioContext.state === "suspended") {
      await state.audioContext.resume();
    }
  } catch (error) {
    setStatus("Audio context could not start.", true);
    return false;
  }

  if (resetStep) {
    state.currentStep = 0;
  }

  state.isPlaying = true;
  elements.playhead.classList.add("is-visible");
  playStep(state.currentStep);
  updatePlayhead();
  state.currentStep = (state.currentStep + 1) % state.song.steps;
  scheduleNextTick();
  syncTransportState();
  if (announce) {
    setStatus("Playback started.");
  }
  return true;
}

function pausePlayback() {
  state.isPlaying = false;
  if (state.timerId) {
    window.clearTimeout(state.timerId);
    state.timerId = null;
  }
  elements.playhead.classList.add("is-visible");
  updatePlayhead();
  syncTransportState();
  setStatus("Playback paused.");
}

function stopPlayback() {
  state.isPlaying = false;
  if (state.timerId) {
    window.clearTimeout(state.timerId);
    state.timerId = null;
  }
  state.currentStep = 0;
  elements.playhead.classList.remove("is-visible");
  updatePlayhead();
  syncTransportState();
}

async function startRecording() {
  if (state.isRecording) {
    return;
  }

  if (!canRecordAudio()) {
    setStatus("Recording is not supported in this browser.", true);
    return;
  }

  ensureAudio();
  if (!state.audioContext || !state.mediaStreamDestination) {
    setStatus("Audio recording is not available in this browser.", true);
    return;
  }

  try {
    if (state.audioContext.state === "suspended") {
      await state.audioContext.resume();
    }
  } catch (error) {
    setStatus("Audio context could not start.", true);
    return;
  }

  const mimeType = getRecordingMimeType();
  let recorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(state.mediaStreamDestination.stream, { mimeType })
      : new MediaRecorder(state.mediaStreamDestination.stream);
  } catch (error) {
    setStatus("Recording could not start in this browser.", true);
    return;
  }

  cleanupRecordingUrl();
  state.recordedChunks = [];
  state.recordingMimeType = mimeType || recorder.mimeType || "audio/webm";
  state.mediaRecorder = recorder;
  recorder.addEventListener("dataavailable", handleRecordingData);
  recorder.addEventListener("stop", handleRecordingStop, { once: true });

  stopPlayback();

  try {
    recorder.start(250);
  } catch (error) {
    state.mediaRecorder = null;
    setStatus("Recording could not start.", true);
    return;
  }

  state.isRecording = true;
  syncTransportState();

  const started = await startPlayback({ resetStep: true, announce: false });
  if (!started) {
    state.isRecording = false;
    syncTransportState();
    if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
      state.mediaRecorder.stop();
    }
    return;
  }

  setStatus("Recording started. Press Stop Rec to save the audio.");
}

function stopRecording() {
  if (!state.isRecording) {
    return;
  }

  state.isRecording = false;
  syncTransportState();
  stopPlayback();

  if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") {
    return;
  }

  state.mediaRecorder.stop();
  setStatus("Finalizing recording...");
}

function restartPlaybackFromCurrentStep() {
  if (!state.isPlaying) {
    return;
  }
  if (state.timerId) {
    window.clearTimeout(state.timerId);
  }
  scheduleNextTick();
}

function scheduleNextTick() {
  if (!state.isPlaying) {
    return;
  }
  state.timerId = window.setTimeout(() => {
    tick();
    scheduleNextTick();
  }, stepDurationMs());
}

function tick() {
  const step = state.currentStep;
  playStep(step);
  updatePlayhead();
  state.currentStep = (state.currentStep + 1) % state.song.steps;
}

function playStep(step) {
  const now = state.audioContext.currentTime;
  const lengthSeconds = stepDurationMs() / 1000;

  state.song.notes.forEach((note) => {
    if (note.step !== step) {
      return;
    }
    const rowIndex = resolveRowIndex(note);
    const row = state.song.rows[rowIndex];
    const frequency = noteToFrequency(row.note);
    if (frequency) {
      playTone(frequency, Math.max(lengthSeconds * note.length * 0.92, 0.08), now);
    }
  });

  state.song.drums.forEach((hit) => {
    if (hit.step !== step) {
      return;
    }
    if (hit.lane === "kick") {
      playKick(now);
    } else if (hit.lane === "snare") {
      playSnare(now);
    } else if (hit.lane === "hat") {
      playHat(now);
    }
  });
}

function updatePlayhead() {
  const { gap, cellWidth } = getGridMetrics();
  const position = state.currentStep * (cellWidth + gap);
  elements.playhead.style.width = `${cellWidth}px`;
  elements.playhead.style.transform = `translateX(${position}px)`;
}

function ensureAudio() {
  if (state.audioContext) {
    return;
  }

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) {
    return;
  }

  state.audioContext = new AudioCtor();
  state.masterGain = state.audioContext.createGain();
  state.masterGain.gain.value = 0.18;
  state.masterGain.connect(state.audioContext.destination);
  if (typeof state.audioContext.createMediaStreamDestination === "function") {
    state.mediaStreamDestination = state.audioContext.createMediaStreamDestination();
    state.masterGain.connect(state.mediaStreamDestination);
  }
  state.noiseBuffer = createNoiseBuffer(state.audioContext);
}

function playTone(frequency, duration, startTime) {
  const oscillator = state.audioContext.createOscillator();
  const shimmer = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();
  const filter = state.audioContext.createBiquadFilter();

  oscillator.type = "triangle";
  shimmer.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  shimmer.frequency.setValueAtTime(frequency * 2, startTime);
  shimmer.detune.setValueAtTime(6, startTime);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2200, startTime);
  filter.Q.value = 1.6;

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(0.16, startTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(filter);
  shimmer.connect(filter);
  filter.connect(gain);
  gain.connect(state.masterGain);

  oscillator.start(startTime);
  shimmer.start(startTime);
  oscillator.stop(startTime + duration + 0.04);
  shimmer.stop(startTime + duration + 0.04);
}

function playKick(startTime) {
  const oscillator = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(140, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(42, startTime + 0.18);

  gain.gain.setValueAtTime(0.22, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);

  oscillator.connect(gain);
  gain.connect(state.masterGain);
  oscillator.start(startTime);
  oscillator.stop(startTime + 0.2);
}

function playSnare(startTime) {
  const noise = state.audioContext.createBufferSource();
  noise.buffer = state.noiseBuffer;

  const noiseFilter = state.audioContext.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.setValueAtTime(1600, startTime);

  const noiseGain = state.audioContext.createGain();
  noiseGain.gain.setValueAtTime(0.18, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);

  const tone = state.audioContext.createOscillator();
  const toneGain = state.audioContext.createGain();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(220, startTime);
  toneGain.gain.setValueAtTime(0.07, startTime);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.1);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(state.masterGain);

  tone.connect(toneGain);
  toneGain.connect(state.masterGain);

  noise.start(startTime);
  tone.start(startTime);
  noise.stop(startTime + 0.2);
  tone.stop(startTime + 0.12);
}

function playHat(startTime) {
  const noise = state.audioContext.createBufferSource();
  noise.buffer = state.noiseBuffer;

  const filter = state.audioContext.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(4200, startTime);

  const gain = state.audioContext.createGain();
  gain.gain.setValueAtTime(0.08, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(state.masterGain);

  noise.start(startTime);
  noise.stop(startTime + 0.06);
}

function createNoiseBuffer(audioContext) {
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function exportSong() {
  const blob = new Blob([JSON.stringify(state.song, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(state.song.title)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("JSON exported.");
}

function tryLoadJson(rawText, successMessage) {
  try {
    const parsed = JSON.parse(rawText);
    loadSong(parsed, successMessage);
  } catch (error) {
    setStatus(`Invalid JSON: ${error.message}`, true);
  }
}

function loadSong(rawSong, successMessage) {
  try {
    if (state.isRecording) {
      stopRecording();
    }
    stopPlayback();
    state.song = normalizeSong(rawSong);
    persistSong();
    syncFormToSong();
    renderSong();
    setStatus(successMessage);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function normalizeSong(rawSong) {
  if (!rawSong || typeof rawSong !== "object" || Array.isArray(rawSong)) {
    throw new Error("Song JSON must be an object.");
  }

  const steps = clampNumber(Number(rawSong.steps), 4, 32, 8);
  const tempo = clampNumber(Number(rawSong.tempo), 70, 180, 120);
  const rows = normalizeRows(rawSong.rows, rawSong.notes);
  const notes = normalizeNotes(rawSong.notes, rows, steps);
  const drums = normalizeDrums(rawSong.drums, steps);

  return {
    title: String(rawSong.title || "Untitled Pattern").slice(0, 64),
    tempo,
    steps,
    rows,
    notes,
    drums,
  };
}

function normalizeRows(rawRows, rawNotes) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    const inferredRows = inferRowsFromNotes(rawNotes);
    if (inferredRows.length > 0) {
      return inferredRows;
    }
    return DEFAULT_ROWS.map((row) => ({ ...row }));
  }

  const rows = rawRows
    .map((row, index) => {
      if (typeof row === "string") {
        return { note: row, color: DEFAULT_ROWS[index % DEFAULT_ROWS.length].color };
      }

      if (!row || typeof row !== "object") {
        return null;
      }

      const note = String(row.note || "").trim();
      if (!note) {
        return null;
      }

      return {
        note,
        color: typeof row.color === "string" && row.color.trim()
          ? row.color.trim()
          : DEFAULT_ROWS[index % DEFAULT_ROWS.length].color,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return DEFAULT_ROWS.map((row) => ({ ...row }));
  }

  return rows.slice(0, 16);
}

function inferRowsFromNotes(rawNotes) {
  if (!Array.isArray(rawNotes)) {
    return [];
  }

  const uniqueNotes = Array.from(
    new Set(
      rawNotes
        .map((note) => (note && typeof note === "object" ? String(note.note || "").trim() : ""))
        .filter((note) => noteToFrequency(note)),
    ),
  );

  uniqueNotes.sort((left, right) => noteToFrequency(right) - noteToFrequency(left));

  return uniqueNotes.slice(0, 16).map((note, index) => ({
    note,
    color: DEFAULT_ROWS[index % DEFAULT_ROWS.length].color,
  }));
}

function normalizeNotes(rawNotes, rows, steps) {
  if (!Array.isArray(rawNotes)) {
    return [];
  }

  const normalized = rawNotes
    .map((note) => {
      if (!note || typeof note !== "object") {
        return null;
      }

      const step = clampNumber(Number(note.step), 0, steps - 1, 0);
      const parsedRow = Number(note.row);
      const row = Number.isInteger(parsedRow)
        ? parsedRow
        : rows.findIndex((item) => item.note === note.note);
      if (!Number.isInteger(row) || row < 0 || row >= rows.length) {
        return null;
      }

      const length = clampNumber(Number(note.length), 1, steps - step, 1);
      return {
        step,
        note: rows[row].note,
        length,
      };
    })
    .filter(Boolean);

  normalized.sort((left, right) => left.step - right.step || left.note.localeCompare(right.note));
  return normalized;
}

function normalizeDrums(rawDrums, steps) {
  if (!Array.isArray(rawDrums)) {
    return [];
  }

  const normalized = rawDrums
    .map((hit) => {
      if (!hit || typeof hit !== "object") {
        return null;
      }

      const lane = String(hit.lane || "").toLowerCase();
      if (!DRUM_LANES.includes(lane)) {
        return null;
      }

      return {
        step: clampNumber(Number(hit.step), 0, steps - 1, 0),
        lane,
      };
    })
    .filter(Boolean);

  normalized.sort((left, right) => left.step - right.step || left.lane.localeCompare(right.lane));
  return normalized;
}

function resolveRowIndex(note) {
  const directMatch = state.song.rows.findIndex((row) => row.note === note.note);
  if (directMatch >= 0) {
    return directMatch;
  }
  return 0;
}

function hasDrumHit(step, lane) {
  return state.song.drums.some((hit) => hit.step === step && hit.lane === lane);
}

function stepDurationMs() {
  return (60_000 / state.song.tempo) / 2;
}

function getGridMetrics() {
  const gap = window.innerWidth <= 760 ? 4 : 6;
  const width = elements.melodyNotes.clientWidth || 1;
  const height = elements.melodyNotes.clientHeight || 1;
  const cellWidth = (width - gap * (state.song.steps - 1)) / state.song.steps;
  const cellHeight = (height - gap * (state.song.rows.length - 1)) / state.song.rows.length;

  return {
    gap,
    cellWidth,
    cellHeight,
  };
}

function noteToFrequency(note) {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(note).trim());
  if (!match) {
    return null;
  }

  const [, letter, accidental, octaveText] = match;
  const semitones = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };

  let midi = (Number(octaveText) + 1) * 12 + semitones[letter.toUpperCase()];
  if (accidental === "#") {
    midi += 1;
  }
  if (accidental === "b") {
    midi -= 1;
  }
  return 440 * 2 ** ((midi - 69) / 12);
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function canRecordAudio() {
  return typeof MediaRecorder !== "undefined";
}

function getRecordingMimeType() {
  if (!canRecordAudio()) {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];

  for (const candidate of candidates) {
    if (typeof MediaRecorder.isTypeSupported !== "function") {
      return candidate;
    }
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return "";
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sortNotes() {
  state.song.notes.sort((left, right) => left.step - right.step || left.note.localeCompare(right.note));
}

function sortDrums() {
  state.song.drums.sort((left, right) => left.step - right.step || left.lane.localeCompare(right.lane));
}

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.toggle("is-error", isError);
}

function syncTransportState() {
  elements.playButton.textContent = state.isPlaying ? "Pause" : "Play";
  elements.playButton.disabled = state.isRecording;
  elements.stopButton.disabled = state.isRecording;
  elements.recordButton.disabled = state.isRecording || !canRecordAudio();
  elements.stopRecordButton.disabled = !state.isRecording;
  elements.recordingBadge.hidden = !state.isRecording;
  elements.loadDemoButton.disabled = state.isRecording;
  elements.applyButton.disabled = state.isRecording;
  elements.formatButton.disabled = state.isRecording;
  elements.fileInput.disabled = state.isRecording;
  elements.tempoSlider.disabled = state.isRecording;
  elements.lengthSelect.disabled = state.isRecording;
  elements.jsonInput.readOnly = state.isRecording;
}

function handleRecordingData(event) {
  if (event.data && event.data.size > 0) {
    state.recordedChunks.push(event.data);
  }
}

function handleRecordingStop() {
  const mimeType = state.recordingMimeType || "audio/webm";
  const chunks = [...state.recordedChunks];

  state.recordedChunks = [];
  state.mediaRecorder = null;

  if (chunks.length === 0) {
    setStatus("Recording stopped, but no audio was captured.", true);
    return;
  }

  const blob = new Blob(chunks, { type: mimeType });
  const filename = buildRecordingFilename(mimeType);
  cleanupRecordingUrl();
  state.recordingUrl = URL.createObjectURL(blob);
  elements.recordingLink.href = state.recordingUrl;
  elements.recordingLink.download = filename;
  elements.recordingLink.textContent = `Download ${filename}`;
  elements.recordingLink.classList.remove("is-hidden");
  setStatus("Recording ready. If download did not start, use the link below.");

  try {
    elements.recordingLink.click();
  } catch (error) {
    // Keep the download link visible when browsers block programmatic download.
  }
}

function buildRecordingFilename(mimeType) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    padNumber(now.getMonth() + 1),
    padNumber(now.getDate()),
    "-",
    padNumber(now.getHours()),
    padNumber(now.getMinutes()),
    padNumber(now.getSeconds()),
  ].join("");

  return `${slugify(state.song.title || "music-maker")}-${stamp}.${mimeTypeToExtension(mimeType)}`;
}

function mimeTypeToExtension(mimeType) {
  if (mimeType.includes("ogg")) {
    return "ogg";
  }
  if (mimeType.includes("mp4")) {
    return "m4a";
  }
  return "webm";
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function cleanupRecordingUrl() {
  if (state.recordingUrl) {
    URL.revokeObjectURL(state.recordingUrl);
    state.recordingUrl = null;
  }
  elements.recordingLink.classList.add("is-hidden");
  elements.recordingLink.removeAttribute("href");
  elements.recordingLink.removeAttribute("download");
  elements.recordingLink.textContent = "Download last recording";
}

function persistSong() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.song));
  } catch (error) {
    // Ignore storage failures so the app still works when localStorage is unavailable.
  }
}

function loadSavedSong() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return normalizeSong(DEMO_SONG);
  }
  if (!raw) {
    return normalizeSong(DEMO_SONG);
  }

  try {
    return normalizeSong(JSON.parse(raw));
  } catch (error) {
    return normalizeSong(DEMO_SONG);
  }
}
