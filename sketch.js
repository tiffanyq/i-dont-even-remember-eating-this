let notebookImg;
let stickerData = [];
let thoughts = []; // everything from thoughts.json
let currentSticker;
let placedStickers = [];
let cnv;
let spawnerImg;
let drag = null; // drag start
let soundOn = true;
let timeOfDay = 0;

const TIMES_OF_DAY = [
  "#ff8f4e", // 1. light sunrise / early morning
  "#e6ce1c", // 2. daytime / morning
  "#6dc0ff", // 3. noon / peak brightness
  "#1cb9e5", // 4. afternoon, dimmer
  "#dd91e9", // 5. evening, early sunset
  "#a62e54", // 6. deep sunset
  "#0f163d", // 7. night
  "#575a96", // 8. night, prepping for morning
];
const MARQUEE_WORDS = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"];
const STICKER_SCALE_FACTOR = 0.45;

// sounds
const peelSound = new Audio("sound/peel.mp3");
const stickSound = new Audio("sound/stick.mp3");
const thoughtSound = new Audio("sound/thought.mp3");
const selectionSound = new Audio("sound/selection.mp3");
const backgroundSound = new Audio("sound/background_sound.mp3");
backgroundSound.loop = true;
backgroundSound.volume = 0.3;

const audioCtx = new AudioContext();

function boost(audio, amount) {
  const source = audioCtx.createMediaElementSource(audio);
  const gain = audioCtx.createGain();
  gain.gain.value = amount;
  source.connect(gain).connect(audioCtx.destination);
}

boost(peelSound, 2);
boost(stickSound, 5);

async function setup() {
  showTimeOfDay();
  updateMarquee();

  const intro = document.getElementById("intro");
  document.getElementById("start-button").addEventListener("click", () => {
    intro.classList.add("hidden");
    audioCtx.resume();
    startBackgroundSound();
  });

  const soundToggle = document.getElementById("sound-toggle");
  soundToggle.addEventListener("click", () => {
    soundOn = !soundOn;
    soundToggle.innerText = soundOn ? "🔈" : "🔇";
    soundToggle.setAttribute("aria-pressed", soundOn);
    if (soundOn) {
      startBackgroundSound();
    } else {
      backgroundSound.pause();
    }
  });
  // dimiss modal upon option select
  for (const option of document.querySelectorAll(".thought-option")) {
    option.addEventListener("click", () => {
      playSound(selectionSound);
      hideThought();
    });
  }

  const d = await fetch("stickers.json");
  stickerData = await d.json();
  const t = await fetch("thoughts.json");
  thoughts = await t.json();
  notebookImg = await loadImage("calendar.png");
  for (const s of stickerData) {
    s.imageFile = await loadImage("stickers/" + s.image);
  }

  // set up canvas aspect ratio
  const aspectRatio = notebookImg.height / notebookImg.width;
  const w = constrain(min(windowWidth - 32, (windowHeight - 260) / aspectRatio), 700, 1200);
  cnv = createCanvas(w, w * aspectRatio);
  cnv.parent("notebook");

  // associated random thought
  cnv.elt.addEventListener("click", (e) => {
    const p = stickerAt(e.clientX, e.clientY);
    if (p) {
      playSound(thoughtSound);
      showThought(p.thought);
    }
  });

  cnv.elt.addEventListener("pointermove", (e) => {
    cnv.elt.style.cursor = stickerAt(e.clientX, e.clientY) ? "pointer" : "";
  });

  // init sticker
  spawnerImg = document.getElementById("current-sticker-img");
  spawnSticker();

  // init sticker dragging
    spawnerImg.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    playSound(peelSound);
    spawnerImg.setPointerCapture(e.pointerId);
    spawnerImg.classList.remove("snapping-back");
    spawnerImg.classList.add("dragging");
    document.body.classList.add("dragging-sticker");
    drag = {
      startX: e.clientX,
      startY: e.clientY
    };
  });

  spawnerImg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    spawnerImg.style.transform = `translate(${dx}px, ${dy}px)`;
  });

  spawnerImg.addEventListener("pointerup", placeSticker);
  spawnerImg.addEventListener("pointercancel", placeSticker);

  noLoop(); // redraw when sticker added

  // allow start after loading done
  document.getElementById("start-button").disabled = false;
  document.getElementById("start-label").innerText = "start sticking";
}

function draw() {
  image(notebookImg, 0, 0, width, height);

  drawingContext.shadowColor = "rgba(0, 0, 0, 0.4)";
  drawingContext.shadowBlur = 6;
  drawingContext.shadowOffsetX = 1;
  drawingContext.shadowOffsetY = 3;

  for (const p of placedStickers) {
    const r = stickerRect(p);
    image(p.sticker.imageFile, r.x, r.y, r.w, r.h);
  }
}

// where a placed sticker is drawn on the canvas: top-left corner, width, height
function stickerRect(p) {
  const img = p.sticker.imageFile;
  const w = img.width * STICKER_SCALE_FACTOR;
  const h = img.height * STICKER_SCALE_FACTOR;
  return { x: p.x - w/2, y: p.y - h/2, w, h };
}

// which placed sticker is at this point on the screen (or null if none).
// checks from the end of the list, because later stickers are drawn on top
function stickerAt(clientX, clientY) {
  const canvasBox = cnv.elt.getBoundingClientRect();
  const x = clientX - canvasBox.left;
  const y = clientY - canvasBox.top;
  for (let i = placedStickers.length - 1; i >= 0; i--) {
    const r = stickerRect(placedStickers[i]);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      return placedStickers[i];
    }
  }
  return null;
}

function spawnSticker() {
  currentSticker = random(stickerData);
  spawnerImg.src = "stickers/" + currentSticker.image;
  document.getElementById("current-sticker-container").style.backgroundColor = currentSticker.hex;
  document.getElementById("current-produce-name").innerText= currentSticker.name;
  document.getElementById("current-produce-name").style.color = currentSticker.hex;
}

function placeSticker(e) {
  if (!drag) return;
  drag = null; // reset current drag
  spawnerImg.classList.remove("dragging");
  document.body.classList.remove("dragging-sticker");
  const canvasBox = cnv.elt.getBoundingClientRect();
  const isOverCanvas =
    e.clientX >= canvasBox.left &&
    e.clientX <= canvasBox.right &&
    e.clientY >= canvasBox.top &&
    e.clientY <= canvasBox.bottom;

  if (e.type === "pointerup" && isOverCanvas) {
    const stickerBox = spawnerImg.getBoundingClientRect();
    placedStickers.push({
      sticker: currentSticker,
      x: stickerBox.left + stickerBox.width/2 - canvasBox.left,
      y: stickerBox.top + stickerBox.height/2 - canvasBox.top,
      thought: random(thoughts),
    });
    spawnerImg.style.transform = "";
    playSound(stickSound);
    advanceTimeOfDay();
    updateMarquee();
    spawnSticker();
  } else {
    spawnerImg.classList.add("snapping-back");
    spawnerImg.style.transform = "";
  }
  redraw();
}

function showTimeOfDay() {
  document.getElementById("time-tint").style.backgroundColor = TIMES_OF_DAY[timeOfDay];
  document.getElementById("marquee").style.backgroundColor = TIMES_OF_DAY[timeOfDay];
  document.documentElement.style.setProperty("--time-colour", TIMES_OF_DAY[timeOfDay]);
}

// move to the next time of day, loop back to sunrise at the end
function advanceTimeOfDay() {
  timeOfDay = (timeOfDay + 1) % TIMES_OF_DAY.length;
  showTimeOfDay();
}

function updateMarquee() {
  const periods = ".".repeat(placedStickers.length);
  const groups = MARQUEE_WORDS.map((word) => {
    return Array(4).fill(word + periods).join(" ");
  });
  // gap between groups
  const gap = "\u00A0".repeat(10);
  const marqueeText = groups.join(gap) + gap;

  for (const marqueeCopy of document.querySelectorAll(".marquee-copy")) {
    marqueeCopy.textContent = marqueeText;
  }
}

function showThought(thought) {
  document.getElementById("thought-text").innerText = thought.thought;

  const option1 = document.getElementById("thought-option-1");
  const option2 = document.getElementById("thought-option-2");
  option1.innerText = thought.options[0];
  if (thought.options.length > 1) {
    option2.innerText = thought.options[1];
    option2.hidden = false;
  } else {
    option2.hidden = true;
  }

  document.getElementById("thought").classList.remove("hidden");
}

function hideThought() {
  document.getElementById("thought").classList.add("hidden");
}

function playSound(sound) {
  if (!soundOn) return;
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

function startBackgroundSound() {
  if (!soundOn) return;
  if (!backgroundSound.paused) return;
  backgroundSound.play().catch(() => {});
}