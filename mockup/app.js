const BACKEND_URL = localStorage.getItem("throughlineBackendUrl") || "http://127.0.0.1:5180";
const MAX_STEP = 4;
const SAMPLE_NOTE = "I need this to go to my agent. Remind me tomorrow to follow up with Sarah about pricing, and remember that the product should feel like a voice note app first, with MCP as the passthrough.";

const track = document.querySelector("#screenTrack");
const dots = Array.from(document.querySelectorAll("[data-go]"));
const nextButtons = Array.from(document.querySelectorAll("[data-next]"));
const recordButton = document.querySelector("#recordButton");
const topAction = document.querySelector("#topAction");
const recordLabel = document.querySelector("#recordLabel");
const timer = document.querySelector("#timer");
const wave = document.querySelector(".wave");
const noteForm = document.querySelector("#noteForm");
const transcriptInput = document.querySelector("#transcriptInput");
const captureStatus = document.querySelector("#captureStatus");
const sendButton = document.querySelector("#sendButton");
const sampleButton = document.querySelector("#sampleButton");
const typeButtons = Array.from(document.querySelectorAll("[data-type]"));
const homeRecordButton = document.querySelector("#homeRecordButton");
const viewHomeButton = document.querySelector("#viewHomeButton");

const processingEyebrow = document.querySelector("#processingEyebrow");
const noteTitle = document.querySelector("#noteTitle");
const transcriptPreview = document.querySelector("#transcriptPreview");
const todoList = document.querySelector("#todoList");
const summaryPreview = document.querySelector("#summaryPreview");
const pillRow = document.querySelector("#pillRow");
const homeHeading = document.querySelector("#homeHeading");
const homeMeta = document.querySelector("#homeMeta");
const homeTitle = document.querySelector("#homeTitle");
const homeSummary = document.querySelector("#homeSummary");
const homePills = document.querySelector("#homePills");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let step = 0;
let isRecording = false;
let elapsed = 0;
let timerId = null;
let selectedType = "freeform";
let recognition = null;
let recognitionBaseText = "";
let recognitionFinalText = "";
let currentRecording = null;

function setStep(nextStep) {
  step = Math.max(0, Math.min(MAX_STEP, nextStep));
  track.style.transform = `translateX(-${step * 100}%)`;
  dots.forEach((dot, index) => {
    dot.classList.toggle("is-active", index === step);
  });

  if (step === 4) {
    topAction.className = "top-action";
    topAction.textContent = "connect →";
    topAction.setAttribute("aria-label", "Connect an agent");
  } else {
    topAction.className = "top-action icon-button";
    topAction.innerHTML = "<span></span><span></span><span></span>";
    topAction.setAttribute("aria-label", "Settings");
  }
}

function setStatus(message, tone = "neutral") {
  captureStatus.textContent = message;
  captureStatus.classList.toggle("is-error", tone === "error");
  captureStatus.classList.toggle("is-success", tone === "success");
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function setSelectedType(type) {
  selectedType = type;
  typeButtons.forEach((button) => {
    const selected = button.dataset.type === type;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function startTimer() {
  elapsed = 0;
  timer.textContent = formatTime(elapsed);
  timerId = setInterval(() => {
    elapsed += 1;
    timer.textContent = formatTime(elapsed);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function stopRecording() {
  if (recognition) {
    recognition.stop();
  }

  isRecording = false;
  stopTimer();
  recordButton.classList.remove("is-recording");
  wave.classList.remove("is-on");
  recordButton.setAttribute("aria-label", "Start dictation");
  recordLabel.textContent = transcriptInput.value.trim() ? "ready to send" : "tap to dictate";
}

function startRecording() {
  if (!SpeechRecognition) {
    transcriptInput.focus();
    recordLabel.textContent = "type your note";
    setStatus("Browser dictation is not available here. Type or paste the note and send it.", "error");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognitionBaseText = transcriptInput.value.trim();
  recognitionFinalText = "";

  recognition.onresult = (event) => {
    let interimText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const fragment = event.results[index][0].transcript.trim();
      if (event.results[index].isFinal) {
        recognitionFinalText = joinText(recognitionFinalText, fragment);
      } else {
        interimText = joinText(interimText, fragment);
      }
    }
    transcriptInput.value = joinText(recognitionBaseText, recognitionFinalText, interimText);
  };

  recognition.onerror = () => {
    setStatus("Dictation stopped. You can edit the note before sending.", "error");
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording) stopRecording();
  };

  isRecording = true;
  startTimer();
  recordButton.classList.add("is-recording");
  wave.classList.add("is-on");
  recordButton.setAttribute("aria-label", "Stop dictation");
  recordLabel.textContent = "listening";
  setStatus("");
  recognition.start();
}

async function sendNote(event) {
  event?.preventDefault();
  if (isRecording) stopRecording();

  const transcript = transcriptInput.value.trim();
  if (!transcript) {
    setStatus("Add a note first.", "error");
    transcriptInput.focus();
    return;
  }

  setStatus("sending to backend...");
  sendButton.disabled = true;
  sampleButton.disabled = true;

  try {
    const response = await fetch(`${BACKEND_URL}/recordings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcript_raw: transcript,
        type: selectedType,
        user_local_time: localIsoString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        duration_seconds: elapsed || null,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `Backend returned ${response.status}`);
    }

    currentRecording = payload.recording;
    renderRecording(currentRecording);
    setStatus("saved to Throughline memory", "success");
    document.activeElement?.blur();
    window.scrollTo({ top: 0, left: 0 });
    setStep(2);
  } catch (error) {
    setStatus(`Could not reach backend at ${BACKEND_URL}. ${error.message}`, "error");
  } finally {
    sendButton.disabled = false;
    sampleButton.disabled = false;
  }
}

async function loadLatestRecording() {
  try {
    const response = await fetch(`${BACKEND_URL}/recordings`);
    if (!response.ok) return;

    const payload = await response.json();
    const latest = payload.recordings?.at(-1);
    if (!latest?.id) return;

    const detailResponse = await fetch(`${BACKEND_URL}/recordings/${latest.id}`);
    if (!detailResponse.ok) return;

    const detailPayload = await detailResponse.json();
    currentRecording = detailPayload.recording;
    renderRecording(currentRecording);
  } catch {
    homeMeta.textContent = "backend offline";
    homePills.innerHTML = '<span class="pill">start backend</span>';
  }
}

function renderRecording(recording) {
  const note = recording?.structured_note;
  const status = recording?.processing_status || "saved";
  const transcript = recording?.transcript_raw || transcriptInput.value.trim();
  const title = note?.title || titleFromTranscript(transcript);
  const summary = note?.summary || transcript || "Saved without transcript.";
  const pills = buildPills(note, status);
  const todos = uniqueItems([
    ...(note?.todos ?? []).map((todo) => todo.text),
    ...(note?.tomorrow_todos ?? []),
  ]);

  processingEyebrow.textContent = status === "processed" ? "agent-ready memory" : status.replaceAll("_", " ");
  noteTitle.textContent = title;
  transcriptPreview.textContent = quote(transcript);
  summaryPreview.textContent = summary;
  todoList.innerHTML = todos.length
    ? todos.map((item) => `<p>${escapeHtml(item)}</p>`).join("")
    : "<p>No todos extracted.</p>";
  pillRow.innerHTML = pills.map((pill) => pillHtml(pill)).join("");

  homeHeading.textContent = formatDay(recording);
  homeMeta.textContent = `${note?.type || recording?.type || selectedType} · ${formatLocalTime(recording)}`;
  homeTitle.textContent = title;
  homeSummary.textContent = summary;
  homePills.innerHTML = pills.map((pill) => pillHtml(pill)).join("");
}

function buildPills(note, status) {
  if (!note) {
    return [{ text: status, mood: false }];
  }

  return uniqueItems([
    note.mood,
    ...(note.centers_of_balance ?? []),
    ...(note.people ?? []),
    ...(note.projects ?? []),
    ...(note.tags ?? []),
  ])
    .filter(Boolean)
    .slice(0, 5)
    .map((text, index) => ({ text, mood: index === 0 }));
}

function pillHtml(pill) {
  return `<span class="pill${pill.mood ? " mood" : ""}">${escapeHtml(pill.text)}</span>`;
}

function titleFromTranscript(transcript) {
  return transcript
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 7)
    .join(" ") || "Untitled note";
}

function formatDay(recording) {
  const date = recording?.user_local_time ? new Date(recording.user_local_time) : new Date();
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date).toLowerCase();
}

function formatLocalTime(recording) {
  const date = recording?.user_local_time ? new Date(recording.user_local_time) : new Date();
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date).toLowerCase();
}

function localIsoString() {
  const date = new Date();
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
  return `${local}${offset}`;
}

function joinText(...parts) {
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

function quote(value) {
  return value ? `"${value}"` : "No transcript.";
}

function uniqueItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const value = String(item || "").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;

    seen.add(key);
    result.push(value);
  }
  return result;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

dots.forEach((dot) => {
  dot.addEventListener("click", () => setStep(Number(dot.dataset.go)));
});

nextButtons.forEach((button) => {
  button.addEventListener("click", () => setStep(step + 1));
});

typeButtons.forEach((button) => {
  button.addEventListener("click", () => setSelectedType(button.dataset.type));
});

recordButton.addEventListener("click", () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

noteForm.addEventListener("submit", sendNote);

sampleButton.addEventListener("click", () => {
  transcriptInput.value = SAMPLE_NOTE;
  setSelectedType("freeform");
  sendNote();
});

homeRecordButton.addEventListener("click", () => {
  transcriptInput.value = "";
  setStatus("");
  setStep(1);
  transcriptInput.focus();
});

viewHomeButton.addEventListener("click", () => {
  setStep(4);
});

topAction.addEventListener("click", () => {
  if (step !== 4) return;

  navigator.clipboard?.writeText("npm run mcp:stdio").then(() => {
    homeMeta.textContent = "connect command copied";
  }).catch(() => {
    homeMeta.textContent = "run npm run mcp:stdio";
  });
});

setStep(0);
loadLatestRecording();
