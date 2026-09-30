let notebookImg;
let stickerData = [];
let currentSticker;
let placedStickers = [];
let cnv;
let spawnerImg;
let drag = null; // drag start
const STICKER_SCALE_FACTOR = 0.18;

async function setup() {
  // load images
  const d = await fetch("stickers.json");
  stickerData = await d.json();
  notebookImg = await loadImage("calendar.png");
  for (const s of stickerData) {
    s.imageFile = await loadImage("stickers/" + s.image);
  }

  // set up canvas aspect ratio
  const aspectRatio = notebookImg.height / notebookImg.width;
  const w = min(windowWidth - 32, (windowHeight - 160) / aspectRatio, 1200); // 160 padding for sticker spawn
  cnv = createCanvas(w, w * aspectRatio);
  cnv.parent("notebook");

  // init sticker
  spawnerImg = document.getElementById("current-sticker-img");
  spawnSticker();

  // init sticker dragging
    spawnerImg.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    spawnerImg.setPointerCapture(e.pointerId);
    spawnerImg.classList.remove("snapping-back");
    spawnerImg.classList.add("dragging");
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
}

function draw() {
  image(notebookImg, 0, 0, width, height);
  for (const p of placedStickers) {
    const img = p.sticker.imageFile;
    const w = img.width * STICKER_SCALE_FACTOR;
    const h = img.height * STICKER_SCALE_FACTOR;
    image(img, p.x - w/2, p.y - h/2, w, h);
  }
}

function spawnSticker() {
  currentSticker = random(stickerData);
  spawnerImg.src = "stickers/" + currentSticker.image;
  document.getElementById("current-sticker-container").style.backgroundColor = currentSticker.hex;
  document.getElementById("current-produce-name").innerText= currentSticker.name;
}

function placeSticker(e) {
  if (!drag) return;
  drag = null; // reset current drag
  spawnerImg.classList.remove("dragging");
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
    });
    spawnerImg.style.transform = "";
    spawnSticker();
  } else {
    spawnerImg.classList.add("snapping-back");
    spawnerImg.style.transform = "";
  }
  redraw();
}