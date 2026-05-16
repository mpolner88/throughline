const MAX_SECONDS = 30;
const BREATH_MORPH_MS = 310;
const BREATH_JOIN_PROGRESS = 0.42;

const breathPaths = {
  left: {
    idle: [57, 46, 75, 46, 94, 46, 111, 46, 111, 46, 111, 46, 111, 46],
    joined: [57, 46, 78, 46, 109, 46, 149, 46, 149, 46, 149, 46, 149, 46],
    recording: [95, 46, 95, 27, 111, 11, 130, 11, 149, 11, 165, 27, 165, 46],
  },
  right: {
    idle: [149, 46, 166, 46, 185, 46, 203, 46, 203, 46, 203, 46, 203, 46],
    joined: [149, 46, 168, 46, 187, 46, 203, 46, 203, 46, 203, 46, 203, 46],
    recording: [165, 46, 165, 65, 149, 81, 130, 81, 111, 81, 95, 65, 95, 46],
  },
};

const controls = Array.from(document.querySelectorAll("[data-recorder]")).map((button) => {
  const concept = button.closest(".concept");
  const timer = concept.querySelector("[data-timer]");
  const label = button.querySelector("[data-label]");
  const breathLeft = button.querySelector("[data-breath-left]");
  const breathRight = button.querySelector("[data-breath-right]");

  return {
    button,
    concept,
    timer,
    label,
    breathLeft,
    breathRight,
    breathProgress: 0,
    breathAnimation: null,
    elapsed: 0,
    interval: null,
  };
});

function formatTime(seconds) {
  return `0:${String(seconds).padStart(2, "0")} / 0:30`;
}

function setProgress(control) {
  const ratio = control.elapsed / MAX_SECONDS;
  const progressDash = 72 + Math.round(ratio * 116);
  const cometDash = 48 + Math.round(ratio * 138);

  control.button.style.setProperty("--progress-dash", `${progressDash} 220`);
  control.button.style.setProperty("--comet-dash", `${cometDash} 226`);
}

function easeMorph(value) {
  return 1 - Math.pow(1 - value, 1.4);
}

function interpolatePath(from, to, progress) {
  return from.map((point, index) => point + (to[index] - point) * progress);
}

function cubicPath(points) {
  return [
    `M${points[0].toFixed(2)} ${points[1].toFixed(2)}`,
    `C${points[2].toFixed(2)} ${points[3].toFixed(2)} ${points[4].toFixed(2)} ${points[5].toFixed(2)} ${points[6].toFixed(2)} ${points[7].toFixed(2)}`,
    `C${points[8].toFixed(2)} ${points[9].toFixed(2)} ${points[10].toFixed(2)} ${points[11].toFixed(2)} ${points[12].toFixed(2)} ${points[13].toFixed(2)}`,
  ].join(" ");
}

function stagedBreathPath(path, progress) {
  if (progress <= BREATH_JOIN_PROGRESS) {
    return interpolatePath(path.idle, path.joined, progress / BREATH_JOIN_PROGRESS);
  }

  return interpolatePath(
    path.joined,
    path.recording,
    (progress - BREATH_JOIN_PROGRESS) / (1 - BREATH_JOIN_PROGRESS),
  );
}

function setBreathMorph(control, progress) {
  if (!control.breathLeft || !control.breathRight) {
    return;
  }

  control.breathProgress = progress;
  control.breathLeft.setAttribute("d", cubicPath(stagedBreathPath(breathPaths.left, progress)));
  control.breathRight.setAttribute("d", cubicPath(stagedBreathPath(breathPaths.right, progress)));
}

function animateBreathMorph(control, target) {
  if (!control.breathLeft || !control.breathRight) {
    return;
  }

  window.cancelAnimationFrame(control.breathAnimation);

  const start = control.breathProgress;
  const distance = Math.abs(target - start);
  const duration = Math.max(180, BREATH_MORPH_MS * distance);
  const startedAt = performance.now();

  function tick(now) {
    const rawProgress = Math.min((now - startedAt) / duration, 1);
    const easedProgress = easeMorph(rawProgress);
    setBreathMorph(control, start + (target - start) * easedProgress);

    if (rawProgress < 1) {
      control.breathAnimation = window.requestAnimationFrame(tick);
    } else {
      control.breathAnimation = null;
      if (target === 1 && control.button.classList.contains("is-recording")) {
        control.button.classList.add("is-breath-spinning");
      }
    }
  }

  control.breathAnimation = window.requestAnimationFrame(tick);
}

function setRecording(control, isRecording) {
  control.button.classList.toggle("is-recording", isRecording);
  control.button.classList.remove("is-breath-spinning");
  control.button.setAttribute("aria-pressed", String(isRecording));
  control.concept.classList.toggle("is-recording", isRecording);
  control.label.textContent = isRecording ? "stop recording" : "start recording";
  animateBreathMorph(control, isRecording ? 1 : 0);

  if (isRecording) {
    control.elapsed = 0;
    control.timer.textContent = formatTime(control.elapsed);
    setProgress(control);
    control.interval = window.setInterval(() => {
      control.elapsed = Math.min(control.elapsed + 1, MAX_SECONDS);
      control.timer.textContent = formatTime(control.elapsed);
      setProgress(control);

      if (control.elapsed >= MAX_SECONDS) {
        setRecording(control, false);
      }
    }, 1000);
  } else {
    window.clearInterval(control.interval);
    control.interval = null;
  }
}

for (const control of controls) {
  control.button.addEventListener("click", () => {
    setRecording(control, !control.button.classList.contains("is-recording"));
  });
}

document.querySelector("#resetAll").addEventListener("click", () => {
  for (const control of controls) {
    setRecording(control, false);
    control.elapsed = 0;
    control.timer.textContent = formatTime(control.elapsed);
    setProgress(control);
  }
});

document.querySelector("#startAll").addEventListener("click", () => {
  for (const control of controls) {
    if (!control.button.classList.contains("is-recording")) {
      setRecording(control, true);
    }
  }
});
