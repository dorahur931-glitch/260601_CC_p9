// =====================================
// REALTIME COLOR HARMONY FIELD
// p5.js + p5.sound
//
// index.html 에 추가:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/addons/p5.sound.min.js"></script>
//
// helvetica.ttf 파일을 sketch.js와 같은 폴더에 위치시킬 것
//
// =====================================

let cam;
let camLayer;
let uiLayer;

let soundPlayers = [];
let started = false;
let reverb;
let startTime = 0;

// 파티클 배열
let particles = [];
let accumulatedParticles = []; // 바닥에 쌓인 파티클들

// 폰트
let helveticaFont;

// C Major 7음계와 색상 매핑
const colorNotes = [
  { name: 'red', freq: 261.63, hue: [345, 15], rgb: [255, 50, 50], label: 'c' },
  { name: 'orange', freq: 293.66, hue: [15, 45], rgb: [255, 165, 50], label: 'd' },
  { name: 'yellow', freq: 329.63, hue: [45, 70], rgb: [255, 255, 50], label: 'e' },
  { name: 'green', freq: 349.23, hue: [70, 160], rgb: [50, 255, 50], label: 'f' },
  { name: 'cyan', freq: 392.00, hue: [160, 200], rgb: [50, 255, 255], label: 'g' },
  { name: 'blue', freq: 440.00, hue: [200, 260], rgb: [50, 100, 255], label: 'a' },
  { name: 'purple', freq: 493.88, hue: [260, 345], rgb: [200, 50, 255], label: 'b' }
];

// ♬ 음표 모양 정밀 좌표 (왼쪽/오른쪽)
// 15초 내에 완성되도록 충분한 위치 제공
const noteShapeLeft = [];
const noteShapeRight = [];

// 왼쪽 음표 ♬ 형태 생성
function generateNoteShapes() {
  // 왼쪽 음표 - 8분음표 형태
  // 머리 부분 (원형, 하단)
  for (let i = 0; i < 150; i++) {
    let angle = random(TWO_PI);
    let radius = random(15, 25);
    noteShapeLeft.push({
      x: 0.08 + cos(angle) * radius / width,
      y: 0.75 + sin(angle) * radius / height
    });
  }
  
  // 기둥 부분 (세로선)
  for (let i = 0; i < 100; i++) {
    noteShapeLeft.push({
      x: 0.08 + random(-3, 3) / width,
      y: random(0.4, 0.75)
    });
  }
  
  // 깃 부분 (상단 곡선)
  for (let i = 0; i < 80; i++) {
    let t = i / 80;
    noteShapeLeft.push({
      x: 0.08 + t * 0.04,
      y: 0.4 - t * 0.1 + sin(t * PI) * 0.02
    });
  }
  
  // 오른쪽 음표 - 반대편 8분음표
  // 머리 부분
  for (let i = 0; i < 150; i++) {
    let angle = random(TWO_PI);
    let radius = random(15, 25);
    noteShapeRight.push({
      x: 0.92 + cos(angle) * radius / width,
      y: 0.75 + sin(angle) * radius / height
    });
  }
  
  // 기둥 부분
  for (let i = 0; i < 100; i++) {
    noteShapeRight.push({
      x: 0.92 + random(-3, 3) / width,
      y: random(0.4, 0.75)
    });
  }
  
  // 깃 부분
  for (let i = 0; i < 80; i++) {
    let t = i / 80;
    noteShapeRight.push({
      x: 0.92 - t * 0.04,
      y: 0.4 - t * 0.1 + sin(t * PI) * 0.02
    });
  }
}

// 파티클 클래스
class ColorParticle {
  constructor(colorData, intensity, side) {
    this.side = side; // 'left' or 'right'
    
    // 양 옆에서만 생성
    if (side === 'left') {
      this.x = random(0, width * 0.2);
    } else {
      this.x = random(width * 0.8, width);
    }
    
    this.y = random(-100, -20);
    this.speed = map(intensity, 0, 1, 6, 15); // 속도 증가
    this.color = colorData.rgb;
    this.label = colorData.label;
    this.size = map(intensity, 0, 1, 10, 22.5);
    this.alpha = 255;
    this.rotation = random(-0.2, 0.2);
    this.rotSpeed = random(-0.05, 0.05);
    this.bouncing = false;
    this.bounceVelocity = 0;
    this.settled = false;
    this.targetX = 0;
    this.targetY = 0;
    this.movingToTarget = false;
  }
  
  update() {
    if (this.settled) {
      return;
    }
    
    if (this.movingToTarget) {
      // 타겟 위치로 부드럽게 이동
      let dx = this.targetX - this.x;
      let dy = this.targetY - this.y;
      this.x += dx * 0.3;
      this.y += dy * 0.3;
      this.rotation *= 0.9;
      
      if (abs(dx) < 1 && abs(dy) < 1) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.rotation = 0;
        this.settled = true;
        accumulatedParticles.push(this);
      }
      return;
    }
    
    if (!this.bouncing) {
      this.y += this.speed;
      this.rotation += this.rotSpeed;
      
      // 바닥에 닿으면 바운스
      if (this.y >= height - 50) {
        this.bouncing = true;
        this.bounceVelocity = -8; // 바운스 속도
      }
    } else {
      // 바운스 물리
      this.bounceVelocity += 0.8;
      this.y += this.bounceVelocity;
      this.rotation += this.rotSpeed * 2;
      
      // 바운스 정점에서 음표 위치로 이동 시작
      if (this.bounceVelocity > 0 && this.y >= height - 100) {
        this.settleIntoNote();
      }
    }
  }
  
  settleIntoNote() {
    this.movingToTarget = true;
    
    // 음표 모양 위치 선택
    let noteShape = this.side === 'left' ? noteShapeLeft : noteShapeRight;
    
    if (noteShape.length > 0) {
      let targetPos = random(noteShape);
      this.targetX = targetPos.x * width + random(-5, 5);
      this.targetY = targetPos.y * height + random(-5, 5);
    } else {
      // fallback
      this.targetX = this.x;
      this.targetY = height - 100;
    }
  }
  
  display() {
    push();
    translate(this.x, this.y);
    rotate(this.rotation);
    
    fill(this.color[0], this.color[1], this.color[2], this.alpha);
    textAlign(CENTER, CENTER);
    textSize(this.size);
    textFont(helveticaFont);
    text(this.label, 0, 0);
    
    pop();
  }
  
  isDead() {
    return this.settled;
  }
}

function preload() {
  helveticaFont = loadFont('helvetica.ttf');
}

function setup() {
  createCanvas(960, 540);
  
  camLayer = createGraphics(960, 540);
  uiLayer = createGraphics(960, 540);
  
  cam = createCapture(VIDEO);
  cam.size(160, 120);
  cam.hide();
  
  textAlign(CENTER, CENTER);
  
  // 음표 형태 생성
  generateNoteShapes();
}

function mousePressed() {
  if (!started) {
    userStartAudio();
    
    reverb = new p5.Reverb();
    reverb.set(3, 2);
    
    for (let i = 0; i < colorNotes.length; i++) {
      let osc = new p5.Oscillator();
      osc.setType('triangle');
      osc.freq(colorNotes[i].freq);
      osc.amp(0);
      osc.start();
      
      reverb.process(osc, 3, 2);
      
      soundPlayers.push({
        colorData: colorNotes[i],
        osc: osc,
        currentAmp: 0
      });
    }
    
    started = true;
    startTime = millis();
  }
}

function touchStarted() {
  mousePressed();
  return false;
}

function draw() {
  background(0);
  
  camLayer.clear();
  camLayer.push();
  camLayer.translate(camLayer.width, 0);
  camLayer.scale(-1, 1);
  camLayer.image(cam, 0, 0, camLayer.width, camLayer.height);
  camLayer.pop();
  
  image(camLayer, 0, 0);
  
  if (!started) {
    fill(255);
    textSize(48);
    textStyle(BOLD);
    text("CLICK OR TAP TO START", width / 2, height / 2);
    return;
  }
  
  analyzeAndPlayHarmony();
  updateParticles();
  
  image(uiLayer, 0, 0);
}

function analyzeAndPlayHarmony() {
  cam.loadPixels();
  
  if (cam.pixels.length < 10) return;
  
  let colorAmount = {};
  for (let i = 0; i < colorNotes.length; i++) {
    colorAmount[colorNotes[i].name] = 0;
  }
  
  let total = 0;
  
  for (let i = 0; i < cam.pixels.length; i += 80) {
    let r = cam.pixels[i];
    let g = cam.pixels[i + 1];
    let b = cam.pixels[i + 2];
    
    let h = rgbToHue(r, g, b);
    
    for (let j = 0; j < colorNotes.length; j++) {
      let hueRange = colorNotes[j].hue;
      if (j === 0) {
        if (h >= hueRange[0] || h < hueRange[1]) {
          colorAmount[colorNotes[j].name]++;
        }
      } else {
        if (h >= hueRange[0] && h < hueRange[1]) {
          colorAmount[colorNotes[j].name]++;
        }
      }
    }
    
    total++;
  }
  
  // 15초 내 완성을 위한 파티클 생성 증가
  let elapsedTime = (millis() - startTime) / 1000;
  let generationMultiplier = elapsedTime < 15 ? 1.5 : 0.3; // 15초까지는 빠르게 생성
  
  for (let i = 0; i < soundPlayers.length; i++) {
    let colorName = soundPlayers[i].colorData.name;
    let ratio = colorAmount[colorName] / total;
    
    let targetAmp = map(ratio, 0, 0.35, 0, 0.4, true);
    soundPlayers[i].osc.amp(targetAmp, 0.2);
    
    if (ratio > 0.02) {
      let particleCount = floor(map(ratio, 0.02, 0.35, 1, 4, true) * generationMultiplier);
      for (let p = 0; p < particleCount; p++) {
        if (random() < 0.5) {
          let intensity = map(ratio, 0.02, 0.35, 0.3, 1, true);
          let side = random() < 0.5 ? 'left' : 'right';
          particles.push(new ColorParticle(soundPlayers[i].colorData, intensity, side));
        }
      }
    }
    
    soundPlayers[i].currentAmp = targetAmp;
  }
}

function updateParticles() {
  uiLayer.clear();
  
  // 쌓인 파티클 먼저 표시
  for (let i = 0; i < accumulatedParticles.length; i++) {
    uiLayer.push();
    uiLayer.translate(accumulatedParticles[i].x, accumulatedParticles[i].y);
    uiLayer.fill(accumulatedParticles[i].color[0], accumulatedParticles[i].color[1], accumulatedParticles[i].color[2], accumulatedParticles[i].alpha);
    uiLayer.textAlign(CENTER, CENTER);
    uiLayer.textSize(accumulatedParticles[i].size);
    uiLayer.textFont(helveticaFont);
    uiLayer.text(accumulatedParticles[i].label, 0, 0);
    uiLayer.pop();
  }
  
  // 떨어지는 파티클 업데이트 및 표시
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    
    uiLayer.push();
    uiLayer.translate(particles[i].x, particles[i].y);
    uiLayer.rotate(particles[i].rotation);
    
    uiLayer.fill(particles[i].color[0], particles[i].color[1], particles[i].color[2], particles[i].alpha);
    uiLayer.textAlign(CENTER, CENTER);
    uiLayer.textSize(particles[i].size);
    uiLayer.textFont(helveticaFont);
    uiLayer.text(particles[i].label, 0, 0);
    
    uiLayer.pop();
    
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }
}

function rgbToHue(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  let maxVal = max(r, g, b);
  let minVal = min(r, g, b);
  let d = maxVal - minVal;
  let h = 0;
  
  if (d === 0) {
    h = 0;
  } else if (maxVal === r) {
    h = ((g - b) / d) % 6;
  } else if (maxVal === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  
  h *= 60;
  if (h < 0) h += 360;
  
  return h;
}
