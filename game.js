console.log("game.js geladen");

// ===== STARS BACKGROUND ANIMATION =====
const bgStarsCanvas = document.getElementById("bgStars");
const bgCtx = bgStarsCanvas.getContext("2d");
bgCtx.imageSmoothingEnabled = false;

let stars = [];
const starCount = 120;

function resizeStarsCanvas() {
    bgStarsCanvas.width = window.innerWidth;
    bgStarsCanvas.height = window.innerHeight;
}

function initStars() {
    stars = [];
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * bgStarsCanvas.width,
            y: Math.random() * bgStarsCanvas.height,
            size: Math.random() * 1.5 + 0.5,
            brightness: Math.random() * 0.7 + 0.3,
            vx: (Math.random() - 0.5) * 0.15,
            vy: (Math.random() - 0.5) * 0.1,
        });
    }
}

function drawStars() {
    bgCtx.fillStyle = "#000000";
    bgCtx.fillRect(0, 0, bgStarsCanvas.width, bgStarsCanvas.height);
    
    for (let star of stars) {
        // Update position (drift)
        star.x += star.vx;
        star.y += star.vy;
        
        // Wrap around
        if (star.x < 0) star.x = bgStarsCanvas.width;
        if (star.x > bgStarsCanvas.width) star.x = 0;
        if (star.y < 0) star.y = bgStarsCanvas.height;
        if (star.y > bgStarsCanvas.height) star.y = 0;
        
        // Subtle flicker
        let flicker = star.brightness + Math.sin(Date.now() * 0.001 + star.x) * 0.1;
        flicker = Math.max(0.2, Math.min(1, flicker));
        
        bgCtx.fillStyle = `rgba(255, 255, 255, ${flicker})`;
        bgCtx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
    }
}

resizeStarsCanvas();
initStars();
window.addEventListener("resize", resizeStarsCanvas);

let lastStarFrame = 0;
function animateStars(now) {
    if (now - lastStarFrame > 16) { // ~60fps
        drawStars();
        lastStarFrame = now;
    }
    requestAnimationFrame(animateStars);
}
requestAnimationFrame(animateStars);

// ===== GAME LOGIC STARTS HERE =====
// Global error handler to surface runtime issues in the overlay
window.onerror = function(msg, src, line, col, err){
    console.error('Global error:', msg, src, line, col, err);
    try{
        if (overlay){
            overlay.classList.remove('hidden'); overlay.classList.add('open');
            overlay.querySelector('h1').textContent = 'Fehler';
            overlay.querySelector('p').textContent = String(msg).slice(0,200);
        }
    }catch(e){}
};
const canvas =
document.getElementById("c");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;
canvas.style.imageRendering = 'pixelated';

const scoreEL = 
document.getElementById("score");
const bestEL =
document.getElementById("best");
const hpEL = document.getElementById("hp");
const hpFill = document.getElementById("hpFill");
const overlay = document.getElementById("overlay");
const earthCanvas = document.getElementById("earthSprite");
const musicToggle = document.getElementById("musicToggle");
const musicVolumeEl = document.getElementById("musicVolume");
const autoShootToggle = document.getElementById("autoShootToggle");
const aimAssistToggle = document.getElementById("aimAssistToggle");
const shipColorEl = document.getElementById('shipColor');
const earthColorEl = document.getElementById('earthColor');
const laserColorEl = document.getElementById('laserColor');
let masterGain = null;
const settingsBtn = document.getElementById("settingsBtn");
const dirBtn = document.getElementById("dirBtn");
const shootBtn = document.getElementById("shootBtn");
let asteroidSprites = [];
const settingsModel = document.getElementById("settingsModel");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const saveSettingsBtn = document.getElementById("saveSettings");
const startBtn = document.getElementById("startBtn");

const w = canvas.clientWidth;
const H = canvas.clientHeight;
canvas.width = w;
canvas.height = H;

let best = Number(localStorage.getItem("best_orbit_guardian") || 0);
bestEL.textContent = best;

let running = false;
let lastTime = 0;

let score = 0;
let coreMaxHP = 5;
let coreHP = coreMaxHP;

// Combo / Streak
let combo = 1;
let comboTimer = 0;
const comboDuration = 2.0;

// Screen shake
let screenShake = 0.0;

// Boss / PowerUps / SlowTime
let bossActive = false;
let nextBossScore = 500;
const bossScoreInterval = 500;
let bossObj = null; // reference to active boss
let powerUps = [];
let slowCharges = 0;
let slowTimer = 0;
let slowCooldown = 0;
const slowDuration = 0.9;
const slowCooldownDuration = 10; // seconds between auto slows
let timeScale = 1.0; // dt multiplier (1.0 normal)

function updatePowerUI(){
    const el = document.getElementById('slowCount'); if (el) el.textContent = String(slowCharges);
}
function updateBossUI(){
    const el = document.getElementById('bossHP'); if (el) el.textContent = bossActive && bossObj ? String(bossObj.hp) : '0';
}

const core = { x: w/2, y: H/2, r: 18};

const orbit = {
    r: Math.min(w,H) * 0.28,
    angle: 0,
    dir: 1,
    omega: 2.6,};

const player = { r: 10};

function updateHPUI(){
    hpEL.textContent = String(coreHP);
    if (hpFill){ hpFill.style.width = (coreHP / coreMaxHP * 100) + '%'; }
}

function updateComboUI(){
    const el = document.getElementById('combo');
    if (el) el.textContent = 'x' + combo;
    // style chip based on level
    const chips = Array.from(document.querySelectorAll('.chip'));
    for (const c of chips){ if (c.textContent.includes('Combo')){
            c.classList.remove('combo-2','combo-3','combo-4','combo');
            if (combo >= 4){ c.classList.add('combo-4'); }
            else if (combo === 3){ c.classList.add('combo-3'); }
            else if (combo === 2){ c.classList.add('combo-2'); }
            else { c.classList.add('combo'); }
            // ensure transient pulse
            setTimeout(()=>{ c.classList.remove('combo'); if (combo >= 2) c.classList.add('combo'); }, 680);
            break;
        } }
}

function resetGame() {
    score = 0;
    coreHP = coreMaxHP;
    combo = 1; comboTimer = 0; updateComboUI();

    orbit.angle = 0;
    orbit.dir = 1;
    scoreEL.textContent = "0";
    updateHPUI();
} 

function startGame() {
    console.log('startGame invoked');
    resetGame();
    running = true;
    overlay.classList.add("hidden");
    overlay.classList.remove("open");
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

function gameOver() {
    running = false;
    if (score > best) {
        best = Math.floor(score);
        localStorage.setItem("best_orbit_guardian", String(best));
        bestEL.textContent = String(best);
    }
    overlay.classList.remove("hidden");
    overlay.classList.add("open");
    // reset combo and update UI
    combo = 1; comboTimer = 0; updateComboUI();
    // update UI
    updateHPUI();
    // sound and music stop
    startAudioIfNeeded();
    playExplosion();
    stopMusic();
    overlay.querySelector("h1").textContent = "Game Over";
    overlay.querySelector("p").textContent = "Tippe Start für eine neue Runde.";
}

function tap() {
    if (!running) return;
    orbit.dir *= -1;
    // sound feedback and ensure audio context can start after user gesture
    startAudioIfNeeded();
    playBeep();
}

function draw() {
    ctx.clearRect(0,0,w,H);
    
    // Enhanced screen shake effect with damping
    ctx.save();
    if (screenShakeAmount > 0) {
        const sx = (Math.random() * 2 - 1) * screenShakeAmount * screenShakeIntensity;
        const sy = (Math.random() * 2 - 1) * screenShakeAmount * screenShakeIntensity;
        ctx.translate(Math.floor(sx), Math.floor(sy));
        screenShakeAmount *= 0.92; // Exponential decay
        screenShakeIntensity *= 0.88;
        if (screenShakeAmount < 0.1) screenShakeAmount = 0;
    }
    
    // Keep legacy screenShake in sync
    screenShake = screenShakeAmount;

    // Stars (pixel)
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 35; i++) {
        const x = Math.floor((i * 97) % w);
        const y = Math.floor((i * 173) % H);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Offscreen indicators for asteroids (arrows on screen edge)
    drawOffscreenIndicators();

    // Orbit ring (crisp)
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(Math.floor(core.x) + 0.5, Math.floor(core.y) + 0.5, Math.floor(orbit.r), 0, Math.PI*2);
    ctx.stroke();

    // HP ring (segments) - Enhanced with glow
    const segments = coreMaxHP;
    const ringR = Math.floor(orbit.r) - 8;
    ctx.lineWidth = 3;
    for (let s = 0; s < segments; s++){
        const start = (s/segments) * Math.PI*2 - Math.PI/2;
        const end = ((s+1)/segments) * Math.PI*2 - Math.PI/2 - 0.02;
        ctx.beginPath();
        if (s < coreHP) {
            // Healthy segments with glow
            ctx.shadowColor = '#2eea8a';
            ctx.shadowBlur = 8;
            ctx.strokeStyle = '#2eea8a';
        } else {
            // Damaged segments
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        }
        ctx.arc(core.x, core.y, ringR, start, end);
        ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Core: draw earth sprite centered with glow
    const earthSize = Math.max(8, Math.floor(core.r * 2.8));
    
    // Add glow effect
    ctx.save();
    ctx.shadowColor = 'rgba(255,200,100,0.4)';
    ctx.shadowBlur = 12;
    
    if (earthCanvas && earthCanvas.width > 0 && earthCanvas.height > 0){
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(earthCanvas, Math.floor(core.x - earthSize/2), Math.floor(core.y - earthSize/2), earthSize, earthSize);
    } else {
        const coreSize = Math.max(2, Math.floor(core.r * 2));
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillRect(Math.floor(core.x - coreSize / 2), Math.floor(core.y - coreSize / 2), coreSize, coreSize);
    }
    
    ctx.restore();

    // Player pixel ship - Enhanced with glow and effects
    const px = Math.floor(core.x + Math.cos(orbit.angle) * orbit.r);
    const py = Math.floor(core.y + Math.sin(orbit.angle) * orbit.r);
    const s = 6;
    
    ctx.save();
    
    // Outer glow
    ctx.shadowColor = hexToRGBA(shipColor, 0.6);
    ctx.shadowBlur = 10;
    ctx.fillStyle = hexToRGBA(shipColor, 0.25);
    ctx.fillRect(px - Math.floor((s + 4) / 2), py - Math.floor((s + 4) / 2), s + 4, s + 4);
    
    // Inner glow
    ctx.shadowColor = hexToRGBA(shipColor, 0.8);
    ctx.shadowBlur = 6;
    ctx.fillStyle = hexToRGBA(shipColor, 0.35);
    ctx.fillRect(px - Math.floor((s + 2) / 2), py - Math.floor((s + 2) / 2), s + 2, s + 2);
    
    // Main bright pixel
    ctx.shadowColor = shipColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = shipColor;
    ctx.fillRect(px - Math.floor(s / 2), py - Math.floor(s / 2), s, s);
    
    ctx.restore();

    ctx.restore();
}

// === ASTEROIDS / BULLETS / PARTICLES ===
let asteroids = [];
let bullets = [];
let particles = [];
let explosions = []; // improved explosion system
let screenShakeAmount = 0;
let screenShakeDuration = 0;
let screenShakeIntensity = 1;
let spawnTimer = 0;
const initialSpawnEvery = 1.2;
let spawnEvery = initialSpawnEvery;
const minSpawnEvery = 0.5;
const spawnDecayRate = 0.002; // slow time-based decay
const baseAsteroidSpeed = 40;
let asteroidSpeed = baseAsteroidSpeed;
const speedIncreaseRate = 0.03; // slow increase per second
const maxAsteroidSpeed = 220;
let timeElapsed = 0;

let shootTimer = 0;
let shootEvery = 0.18;

function spawnAsteroid(){
    if (bossActive) return; // no normal spawns while boss alive
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.max(w,H) * 0.9 + 40;
    const x = core.x + Math.cos(ang) * dist;
    const y = core.y + Math.sin(ang) * dist;
    let speed = asteroidSpeed + Math.random() * 30;
    const dx = core.x - x;
    const dy = core.y - y;
    const len = Math.hypot(dx, dy) || 1;
    const vx = dx / len * speed;
    const vy = dy / len * speed;
    const sprite = asteroidSprites.length ? asteroidSprites[Math.floor(Math.random() * asteroidSprites.length)] : null;

    const r = Math.random();
    let type = 'med'; let radius = 10 + Math.random()*8; let hp = 1; let scoreValue = 15;
    if (r < 0.45){ type = 'small'; radius = 6 + Math.random()*4; speed *= 1.4; hp = 1; scoreValue = 10; }
    else if (r < 0.85){ type = 'med'; radius = 10 + Math.random()*8; hp = 1; scoreValue = 15; }
    else { type = 'big'; radius = 18 + Math.random()*12; speed *= 0.6; hp = 2 + Math.floor(Math.random()*2); scoreValue = 30; }

    asteroids.push({ x, y, vx: dx/len*speed, vy: dy/len*speed, radius, sprite, type, hp, scoreValue });
}

function spawnBoss(){
    bossActive = true;
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.max(w,H) * 0.95 + 60;
    const x = core.x + Math.cos(ang) * dist;
    const y = core.y + Math.sin(ang) * dist;
    const dx = core.x - x; const dy = core.y - y; const len = Math.hypot(dx,dy) || 1;
    const speed = Math.max(18, baseAsteroidSpeed * 0.35);
    const radius = Math.floor(Math.min(Math.max(w,H) * 0.12, 72));
    const hp = 18 + Math.floor(Math.random() * 10);
    bossObj = { x, y, vx: dx/len*speed, vy: dy/len*speed, radius, hp, type: 'boss', isBoss: true };
    asteroids.push(bossObj);
    // make it dramatic: pause normal spawn timer longer
    spawnTimer = Math.max(2.4, spawnEvery * 2.0);
    // big shake and sound
    screenShake = 14; startAudioIfNeeded(); playMusicNote(220, 0.9, 'sawtooth');
    updateBossUI();
}

function shootOnce(manual = false){
    if (shootTimer > 0 || !running) return;
    const px = core.x + Math.cos(orbit.angle) * orbit.r;
    const py = core.y + Math.sin(orbit.angle) * orbit.r;
    const speed = 260;
    const vx = Math.cos(orbit.angle) * speed;
    const vy = Math.sin(orbit.angle) * speed;
    let bullet = { x: px, y: py, vx, vy, life: 2, speed, manual, hit: false };

    // Aim assist (fair): stronger but bounded homing to a nearby target within angle/range
    if (aimAssistToggle?.checked){
        const aimRange = 520; // increased range
        const maxAngle = Math.PI * 0.45; // wider acceptance (~81°)
        let best = null, bestDist = 1e9;
        for (const a of asteroids){
            const dx = a.x - px, dy = a.y - py;
            const dist = Math.hypot(dx,dy);
            if (dist > aimRange) continue;
            const dirDot = (dx*vx + dy*vy) / (dist * speed);
            const angle = Math.acos(Math.max(-1, Math.min(1, dirDot)));
            if (angle <= maxAngle && dist < bestDist){ best = a; bestDist = dist; }
        }
        if (best){ bullet.target = best; bullet.homing = true; bullet.homingFactor = 4.0; } // stronger homing
        // small fire-rate penalty to keep it fair
        shootTimer = shootEvery + 0.06;
    } else {
        shootTimer = shootEvery;
    }

    bullets.push(bullet);
    startAudioIfNeeded(); playBeep(1200, 0.06);
}  

function explode(x, y, count, color = null) {
    // Create more detailed particles with color and size variation
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 120;
        const particleColor = color || (Math.random() > 0.5 ? '#4a9eff' : '#ffff00');
        const size = 2 + Math.random() * 4;
        particles.push({
            x, y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            life: 0.6 + Math.random() * 0.8,
            maxLife: 0.6 + Math.random() * 0.8,
            color: particleColor,
            size: size,
            decay: 0.95 + Math.random() * 0.05
        });
    }
    // Enhanced screen shake with more impact
    const shakeAmount = Math.min(18, count / 1.5);
    screenShakeAmount = Math.max(screenShakeAmount, shakeAmount);
    screenShakeDuration = 0.15;
    screenShakeIntensity = 1;
    startAudioIfNeeded();
    playBeep(1200 - Math.random() * 200, 0.08);
}

function drawAsteroids(){
    for (const a of asteroids){
        const r = Math.max(4, Math.floor(a.radius));
        
        ctx.save();
        // Add glow effect to asteroids
        ctx.shadowColor = 'rgba(255,200,120,0.5)';
        ctx.shadowBlur = Math.max(2, r / 3);
        
        if (a.sprite) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(a.sprite, Math.floor(a.x - r), Math.floor(a.y - r), r*2, r*2);
        } else {
            ctx.fillStyle = '#c0c0c0';
            ctx.fillRect(Math.floor(a.x - r), Math.floor(a.y - r), r*2, r*2);
        }
        ctx.restore();
    }
}

function drawBullets(){
    const lc = laserColor || '#ffd580';
    for (const b of bullets){
        ctx.save();
        ctx.shadowColor = lc;
        ctx.shadowBlur = 6;
        ctx.fillStyle = lc;
        ctx.globalAlpha = 0.95;
        ctx.fillRect(Math.floor(b.x) - 1, Math.floor(b.y) - 1, 3, 3);
        ctx.restore();
    }
}

function drawParticles(){
    for (const p of particles){
        const alpha = Math.max(0, (p.life / p.maxLife) * 0.95);
        const size = p.size * alpha;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color || 'rgba(255,200,120,0.95)';
        
        // Draw main particle with glow
        ctx.shadowColor = p.color || 'rgba(255,200,120,0.8)';
        ctx.shadowBlur = 6;
        ctx.fillRect(Math.floor(p.x - size/2), Math.floor(p.y - size/2), Math.max(1, size), Math.max(1, size));
        
        ctx.restore();
    }
}

function drawPowerUps(){
    for (const pu of powerUps){
        const t = performance.now();
        const pulse = 1 + Math.sin(t/160) * 0.12;
        ctx.save(); ctx.globalAlpha = 0.95; ctx.translate(pu.x, pu.y); ctx.scale(pulse,pulse);
        if (pu.type === 'slow'){
            ctx.fillStyle = 'rgba(120,200,255,0.95)'; ctx.fillRect(-6,-6,12,12);
            ctx.fillStyle = '#042'; ctx.fillRect(-2,-2,4,4);
        } else { ctx.fillStyle = '#fff'; ctx.fillRect(-4,-4,8,8); }
        ctx.restore();
    }
}

function drawOffscreenIndicators(){
    if (!asteroids || asteroids.length === 0) return;
    const off = asteroids.filter(a => (a.x < -36 || a.x > w + 36 || a.y < -36 || a.y > H + 36));
    if (!off.length) return;
    off.sort((A,B) => Math.hypot(A.x-core.x,A.y-core.y) - Math.hypot(B.x-core.x,B.y-core.y));
    const now = performance.now();
    const maxShow = 4;
    for (let i=0;i<Math.min(maxShow, off.length); i++){
        const a = off[i];
        const dx = a.x - core.x, dy = a.y - core.y;
        const ang = Math.atan2(dy,dx);
        const dirx = Math.cos(ang), diry = Math.sin(ang);
        const tx = dirx>0 ? (w - core.x)/dirx : (0 - core.x)/dirx;
        const ty = diry>0 ? (H - core.y)/diry : (0 - core.y)/diry;
        let t = Math.min(Math.abs(tx), Math.abs(ty));
        t = Math.max(20, t*0.9);
        let ix = core.x + dirx * t;
        let iy = core.y + diry * t;
        const margin = 18;
        ix = Math.max(margin, Math.min(w-margin, ix));
        iy = Math.max(margin, Math.min(H-margin, iy));
        const dist = Math.hypot(dx,dy);
        const alpha = Math.max(0.28, Math.min(1, 1 - (dist - Math.max(w,H)/2)/900));
        let col = '#ffd580'; if (a.type === 'med') col = '#ffb86b'; if (a.type === 'big') col = '#ff6b6b';
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(ix, iy);
        ctx.rotate(ang);
        const pulse = 1 + Math.sin(now/180 + i) * 0.09;
        ctx.scale(pulse, pulse);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8, 10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.46)'; ctx.stroke();
        // small type dot for clarity
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(-1, 12, 2, 2);
        ctx.restore();
    }
}

// --- Default asteroid sprite generator (used if no upload is provided) ---
function createDefaultAsteroidSprites(){
    if (asteroidSprites && asteroidSprites.length) return; // already populated
    asteroidSprites = [];
    const variants = 4;
    for (let v = 0; v < variants; v++){
        const size = 24 + v * 6;
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const cx = c.getContext('2d');
        cx.imageSmoothingEnabled = false;
        cx.clearRect(0,0,size,size);
        const grid = Math.ceil(size/2);
        for (let y=0;y<grid;y++){
            for (let x=0;x<grid;x++){
                const nx = x - grid/2 + (Math.random()*0.8-0.4);
                const ny = y - grid/2 + (Math.random()*0.8-0.4);
                const dist = Math.hypot(nx, ny);
                const maxr = grid/2 - 0.5 + v*0.2;
                if (dist < maxr + (Math.random()*0.3-0.15)){
                    const shade = 150 - Math.floor(Math.random()*60) - v*8;
                    cx.fillStyle = `rgb(${shade},${shade},${shade})`;
                    cx.fillRect(Math.floor(x*size/grid), Math.floor(y*size/grid), Math.ceil(size/grid), Math.ceil(size/grid));
                }
            }
        }
        // add some darker spots
        for (let i=0;i<4;i++){
            const rx = Math.floor(Math.random() * size * 0.6 + size*0.2);
            const ry = Math.floor(Math.random() * size * 0.6 + size*0.2);
            cx.fillStyle = 'rgba(40,40,40,0.6)';
            cx.fillRect(rx, ry, Math.ceil(size*0.12), Math.ceil(size*0.12));
        }
        const img = new Image(); img.src = c.toDataURL('image/png');
        asteroidSprites.push(img);
    }
}

function update(dt){
    // time/difficulty progression (slow, smooth)
    timeElapsed += dt;
    spawnEvery = Math.max(minSpawnEvery, initialSpawnEvery * Math.exp(-spawnDecayRate * timeElapsed));
    asteroidSpeed = Math.min(maxAsteroidSpeed, baseAsteroidSpeed + speedIncreaseRate * timeElapsed);
    const difficulty = 1 + Math.max(0, (asteroidSpeed - baseAsteroidSpeed) / 20 + (initialSpawnEvery / spawnEvery - 1) * 0.6);
    const diffEl = document.getElementById('diff'); if (diffEl) diffEl.textContent = difficulty.toFixed(2);

    // spawn (skip when a boss is active)
    spawnTimer -= dt;
    if (!bossActive && spawnTimer <= 0){ spawnTimer = spawnEvery; spawnAsteroid(); }

    // check boss spawn by score
    if (!bossActive && Math.floor(score) >= nextBossScore){ // spawn boss
        spawnBoss(); nextBossScore += bossScoreInterval; }
    updateBossUI();

    // combo timer decay
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer <= 0 && combo > 1){ combo = 1; updateComboUI(); }

    // auto-shoot
    shootTimer = Math.max(0, shootTimer - dt);
    if (document.getElementById('autoShootToggle')?.checked && running){ if (shootTimer <= 0) shootOnce(); }

    // shake decay
    screenShake = Math.max(0, screenShake - dt * 14.0);

    // update asteroids
    for (let i = asteroids.length - 1; i >= 0; i--){
        const a = asteroids[i];
        a.x += a.vx * dt; a.y += a.vy * dt;
        const dx = a.x - core.x; const dy = a.y - core.y; const dist = Math.hypot(dx, dy);
        // critical near-miss slow (auto-trigger) if an asteroid is very close OR if core is at 1 HP
        if (!bossActive && slowCooldown <= 0 && (dist < a.radius + core.r * 0.9 + 18 || coreHP <= 1)){
            // auto-trigger brief slow (dramatic)
            slowTimer = slowDuration; timeScale = 0.4; slowCooldown = slowCooldownDuration; startAudioIfNeeded(); playBeep(520,0.08); screenShake = Math.max(screenShake, 10);
        }
        if (dist < a.radius + core.r * 0.9){
            // hit core
            const dmg = Math.max(1, Math.floor(a.radius / 8));
            coreHP = Math.max(0, coreHP - dmg);
            updateHPUI();
            // reset combo on core hit
            combo = 1; comboTimer = 0; updateComboUI();
            startAudioIfNeeded(); playExplosion();
            explode(a.x, a.y, 12 + Math.floor(a.radius/2));
            asteroids.splice(i,1);
            if (coreHP <= 0){ gameOver(); return; }
        }
    }

    // update bullets and collisions
    for (let i = bullets.length - 1; i >= 0; i--){
        const b = bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        // homing steering (gentle) if assigned a target
        if (b.homing && b.target){
            if (!asteroids.includes(b.target) || Math.hypot(b.x - b.target.x, b.y - b.target.y) > 800){ delete b.homing; delete b.target; }
            else {
                const tx = b.target.x - b.x, ty = b.target.y - b.y;
                const len = Math.hypot(tx,ty) || 1;
                const desiredVx = tx/len * b.speed, desiredVy = ty/len * b.speed;
                // stronger homing factor applied smoothly
                const h = Math.min(1, (b.homingFactor || 1) * dt);
                b.vx = b.vx * (1 - h) + desiredVx * h;
                b.vy = b.vy * (1 - h) + desiredVy * h;
                const l = Math.hypot(b.vx, b.vy) || 1;
                b.vx = b.vx / l * b.speed; b.vy = b.vy / l * b.speed;
            }
        }
        // if bullet expired or went offscreen without hitting -> miss
        if (b.life <= 0 || b.x < -50 || b.x > w + 50 || b.y < -50 || b.y > H + 50){
            // only break combo on manual misses (auto-shoot shouldn't punish)
            if (!b.hit && b.manual){
                combo = 1; comboTimer = 0; updateComboUI();
                // small negative feedback sound
                startAudioIfNeeded(); playBeep(320, 0.06);
                // small visual flash
                const chips = Array.from(document.querySelectorAll('.chip'));
                for (const c of chips){ if (c.textContent.includes('Combo')){ c.classList.add('combo-broken'); setTimeout(()=>c.classList.remove('combo-broken'), 500); break; } }
            }
            bullets.splice(i,1); continue;
        }
        // check power-up hits first
        for (let p = powerUps.length - 1; p >= 0; p--){
            const pu = powerUps[p];
            const pdx = pu.x - b.x, pdy = pu.y - b.y;
            if (pdx*pdx + pdy*pdy < 10*10){
                // collected
                if (pu.type === 'slow'){ slowCharges = Math.min(3, slowCharges + 1); updatePowerUI(); }
                powerUps.splice(p,1); bullets.splice(i,1); startAudioIfNeeded(); playBeep(1320,0.06);
                break;
            }
        }
        for (let j = asteroids.length - 1; j >= 0; j--){
            const a = asteroids[j];
            const dx = a.x - b.x; const dy = a.y - b.y;
            if (dx*dx + dy*dy < (a.radius + 2) ** 2){
                // hit asteroid
                a.hp = (a.hp || 1) - 1;
                if (a.hp > 0){
                    // small hit effect
                    startAudioIfNeeded(); playBeep(900, 0.04);
                    explode(b.x, b.y, 6);
                    bullets.splice(i,1);
                } else {
                    // destroyed
                    explode(a.x, a.y, 14 + Math.floor(a.radius/2));
                    startAudioIfNeeded(); playExplosion();
                    // big splits into smaller
                    if (a.type === 'big'){
                        for (let k=0;k<2;k++){
                            const ang = Math.random()*Math.PI*2;
                            const dist = a.radius;
                            const nx = a.x + Math.cos(ang)*dist;
                            const ny = a.y + Math.sin(ang)*dist;
                            const speed2 = 60 + Math.random()*120;
                            asteroids.push({ x: nx, y: ny, vx: Math.cos(ang)*speed2, vy: Math.sin(ang)*speed2, radius: Math.max(4, a.radius/2), hp:1, type:'small', sprite: a.sprite, scoreValue: 10 });
                        }
                    }
                    // combo: destroyed asteroid increases streak
                    combo = Math.min(999, combo + 1);
                    comboTimer = comboDuration;
                    const assistMultiplier = b.homing ? 0.9 : 1; // small penalty for assisted kills
                    const mult = Math.min(combo, 4); // cap multiplier for score to x4
                    score += (a.scoreValue || 10) * mult * assistMultiplier;
                    scoreEL.textContent = String(Math.floor(score));
                    updateComboUI();
                    // special FX for x2/x3/x4
                    if (combo === 2){ startAudioIfNeeded(); playBeep(1100, 0.06); }
                    if (combo === 3){ startAudioIfNeeded(); playBeep(1200, 0.08); }
                    if (combo >= 4){ startAudioIfNeeded(); playMusicNote(920, 0.14, 'sine'); }
                    // small reward & flourish on milestones
                    if (combo % 5 === 0){ startAudioIfNeeded(); playMusicNote(880, 0.18, 'sine'); playBeep(1400, 0.08); if (coreHP < coreMaxHP){ coreHP = Math.min(coreMaxHP, coreHP + 1); updateHPUI(); } }
                    const wasBoss = !!a.isBoss;
                    asteroids.splice(j,1);
                    bullets.splice(i,1);
                    if (wasBoss){ bossActive = false; bossObj = null; spawnTimer = spawnEvery; updateBossUI(); for (let p=0;p<2;p++){ powerUps.push({ x: a.x + (Math.random()-0.5)*40, y: a.y + (Math.random()-0.5)*40, vx: (Math.random()-0.5)*30, vy: (Math.random()-0.5)*30, life: 8, type: 'slow' }); } startAudioIfNeeded(); playMusicNote(660, 0.16, 'triangle'); console.log('Boss defeated — normal spawns resumed'); }
                }
                break;
            }
        }
    }

    // update particles
    for (let i = particles.length - 1; i >= 0; i--){
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Apply decay and gravity
        p.vx *= (p.decay !== undefined ? p.decay : (1 - dt * 3.0));
        p.vy *= (p.decay !== undefined ? p.decay : (1 - dt * 3.0));
        // Slight gravity pull
        p.vy += 20 * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // update power-ups
    for (let i = powerUps.length - 1; i >= 0; i--){
        const pu = powerUps[i];
        pu.x += (pu.vx || 0) * dt; pu.y += (pu.vy || 0) * dt; pu.life -= dt;
        pu.vx = (pu.vx || 0) * (1 - dt*1.0);
        pu.vy = (pu.vy || 0) * (1 - dt*1.0);
        if (pu.life <= 0) powerUps.splice(i,1);
    }

    // slow timers use real-time decay
    if (slowTimer > 0){ slowTimer -= dt; if (slowTimer <= 0){ slowTimer = 0; timeScale = 1.0; } }
    if (slowCooldown > 0) slowCooldown = Math.max(0, slowCooldown - dt);
    // update power UI
    updatePowerUI();
}

// call draw helpers after main draw
function postDraw(){ drawParticles(); drawBullets(); drawAsteroids(); drawPowerUps(); }

// --- Earth sprite renderer (pixel art) ---
function drawEarthSprite(){
    if (!earthCanvas) { console.warn('drawEarthSprite: earthCanvas nicht gefunden'); return; }
    const sctx = earthCanvas.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    // debug: resize actual canvas pixel buffer to match CSS scaling for crisp pixels
    const rect = earthCanvas.getBoundingClientRect();
    const scale = Math.max(1, Math.round(rect.width / earthCanvas.width));
    if (earthCanvas.width !== Math.floor(rect.width / scale)){
        // upscale buffer to better match display
        earthCanvas.width = 16 * scale;
        earthCanvas.height = 16 * scale;
        // ensure image-rendering remains pixelated via CSS
    }

    const cols = 16, rows = 16;
    // simple 16x16 pixel map (approximation of the provided sprite)
    const map = [
        ['#001133','#001133','#0b325a','#0b325a','#0b325a','#0b325a','#001133','#001133','#001133','#001133','#0b325a','#0b325a','#0b325a','#0b325a','#001133','#001133'],
        ['#001133','#0b325a','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#0b325a','#0b325a','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#0b325a','#001133'],
        ['#0b325a','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#3da33d','#3da33d','#2e8bff','#2e8bff','#0b325a'],
        ['#0b325a','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#3da33d','#3da33d','#3da33d','#3da33d','#2e8bff','#2e8bff','#3da33d','#3da33d','#2e8bff','#0b325a'],
        ['#0b325a','#2e8bff','#2e8bff','#3da33d','#3da33d','#3da33d','#3da33d','#3da33d','#3da33d','#3da33d','#3da33d','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#0b325a'],
        ['#001133','#2e8bff','#2e8bff','#3da33d','#3da33d','#3da33d','#f1c40f','#f1c40f','#3da33d','#3da33d','#3da33d','#2e8bff','#2e8bff','#2e8bff','#0b325a','#001133'],
        ['#001133','#2e8bff','#2e8bff','#3da33d','#3da33d','#3da33d','#f1c40f','#f1c40f','#3da33d','#3da33d','#2e8bff','#2e8bff','#2e8bff','#0b325a','#001133','#001133'],
        ['#001133','#0b325a','#2e8bff','#2e8bff','#3da33d','#3da33d','#3da33d','#3da33d','#3da33d','#2e8bff','#2e8bff','#2e8bff','#0b325a','#001133','#001133','#001133'],
        ['#001133','#001133','#0b325a','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#2e8bff','#0b325a','#001133','#001133','#001133','#001133'],
        ['#001133','#001133','#001133','#0b325a','#0b325a','#0b325a','#0b325a','#2e8bff','#2e8bff','#0b325a','#0b325a','#001133','#001133','#001133','#001133','#001133'],
        ['#001133','#001133','#001133','#001133','#0b325a','#0b325a','#0b325a','#0b325a','#0b325a','#0b325a','#001133','#001133','#001133','#001133','#001133','#001133'],
        ['#001133','#001133','#001133','#001133','#001133','#0b325a','#0b325a','#0b325a','#0b325a','#001133','#001133','#001133','#001133','#001133','#001133','#001133'],
        ['#001133','#001133','#001133','#001133','#001133','#001133','#0b325a','#0b325a','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133'],
        ['#001133','#001133','#001133','#001133','#001133','#001133','#001133','#0b325a','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133'],
        ['#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133'],
        ['#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133','#001133']
    ];

    const pw = earthCanvas.width / cols;
    const ph = earthCanvas.height / rows;
    sctx.clearRect(0,0,earthCanvas.width,earthCanvas.height);
    for (let y=0;y<rows;y++){
        for (let x=0;x<cols;x++){
            sctx.fillStyle = map[y][x];
            sctx.fillRect(Math.floor(x*pw), Math.floor(y*ph), Math.ceil(pw), Math.ceil(ph));
        }
    }
    // apply tint if specified (simple multiply tint to the generated sprite)
    if (typeof earthTint === 'string' && earthTint){
        sctx.globalCompositeOperation = 'multiply';
        sctx.fillStyle = earthTint;
        sctx.fillRect(0,0,earthCanvas.width, earthCanvas.height);
        sctx.globalCompositeOperation = 'source-over';
    }
}

// --- Skins (colors) ---
let shipColor = '#ffffff';
let laserColor = '#ffd580';
let earthTint = '#2e8bff';
function hexToRGBA(hex, alpha){
    if (!hex) return 'rgba(255,255,255,' + (alpha||1) + ')';
    const h = hex.replace('#','');
    const bigint = parseInt(h,16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}
function applySkins(save = true){
    shipColor = (shipColorEl?.value) || shipColor;
    laserColor = (laserColorEl?.value) || laserColor;
    earthTint = (earthColorEl?.value) || earthTint;
    // persist
    if (save){ try{ localStorage.setItem('og_ship_color', shipColor); localStorage.setItem('og_laser_color', laserColor); localStorage.setItem('og_earth_color', earthTint);}catch(e){} }
    // re-render earth sprite with tint
    drawEarthSprite();
}


// --- Simple audio (procedural) ---
let audioCtx = null;
let musicInterval = null;
function startAudioIfNeeded(){
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        const savedVol = Number(localStorage.getItem('og_music_volume'));
        masterGain.gain.value = (!isNaN(savedVol) ? savedVol : 0.35);
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
function setMusicVolume(v){
    if (masterGain) masterGain.gain.value = Number(v);
    localStorage.setItem('og_music_volume', String(v));
    if (musicVolumeEl) musicVolumeEl.value = String(v);
}
function playTone(f, dur=0.12, type='square'){
    if (!audioCtx || !masterGain) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = f;
    o.connect(g); g.connect(masterGain);
    const now = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    o.start(now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.stop(now + dur + 0.02);
}
function playMusicNote(freq, dur=0.5, type='sine', when){
    if (!audioCtx || !masterGain) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(masterGain);
    const now = (when || audioCtx.currentTime);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.02);
    o.start(now);
    g.gain.linearRampToValueAtTime(0.0001, now + dur);
    o.stop(now + dur + 0.02);
}
function startMusic(){
    if (!audioCtx) startAudioIfNeeded();
    if (musicInterval) return;
    const seq = [330, 392, 440, 523];
    let i = 0;
    musicInterval = setInterval(()=>{
        const now = audioCtx.currentTime;
        // gentle pad
        playMusicNote(seq[i%seq.length], 0.8, 'triangle', now);
        // higher lead
        playMusicNote(seq[(i+1)%seq.length]*1.5, 0.38, 'sine', now + 0.06);
        // soft bass
        playMusicNote(seq[i%seq.length]/2, 0.5, 'sawtooth', now);
        i++;
    }, 600);
}
function stopMusic(){ if (musicInterval){ clearInterval(musicInterval); musicInterval = null; } }
function playBeep(freq=880, dur=0.06){ if (!audioCtx) return; playTone(freq, dur, 'square'); }
function playExplosion(){ if (!audioCtx || !masterGain) return; const bufferSize = audioCtx.sampleRate * 0.3; const b = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate); const data = b.getChannelData(0); for (let i=0;i<bufferSize;i++){ data[i] = (Math.random()*2-1) * Math.exp(-i/(bufferSize/8)); }
    const src = audioCtx.createBufferSource(); src.buffer = b; const g = audioCtx.createGain(); src.connect(g); g.connect(masterGain); g.gain.setValueAtTime(0.5, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6); src.start(); }

function loop(now) {
    if (!running) return;
    const rawDt = Math.min(0.033, (now-lastTime)/ 1000);
    // apply timeScale (for slow motion effects)
    const dt = rawDt * (timeScale || 1.0);
    lastTime = now;
    orbit.angle += orbit.dir * orbit.omega * dt;
    score += dt *10; scoreEL.textContent = String(Math.floor(score));

    update(dt);
    draw();
    postDraw();
    requestAnimationFrame(loop);
}
 canvas.addEventListener("pointerdown", (e) =>{
    e.preventDefault();
    tap();
 }
, {
    passive: false
});
if (startBtn){
    startBtn.style.cursor = 'pointer';
    startBtn.disabled = false;
    startBtn.setAttribute('aria-disabled','false');
    startBtn.addEventListener('click', (e)=>{ console.log('startBtn clicked'); e.preventDefault(); startGame(); });
    // listen to pointerup as well for more responsive mobile behavior
    startBtn.addEventListener('pointerup', (e)=>{ console.log('startBtn pointerup'); e.preventDefault(); e.stopPropagation(); startGame(); });
    startBtn.addEventListener('pointerdown', (e)=>{ e.stopPropagation(); });
} else { console.warn('startBtn not found when attaching handlers'); }

// --- Initialization: earth sprite, settings and audio ---
(function initUI(){
    console.log('initUI: starte UI-Initialisierung');
    // ensure default asteroid sprites exist and draw static earth once
    createDefaultAsteroidSprites();
    drawEarthSprite();
    updateComboUI();

    // load skins
    try{ shipColor = localStorage.getItem('og_ship_color') || shipColor; laserColor = localStorage.getItem('og_laser_color') || laserColor; earthTint = localStorage.getItem('og_earth_color') || earthTint; }catch(e){}
    if (shipColorEl) shipColorEl.value = shipColor; if (laserColorEl) laserColorEl.value = laserColor; if (earthColorEl) earthColorEl.value = earthTint;
    applySkins(false);
    shipColorEl?.addEventListener('input', ()=> applySkins(true));
    laserColorEl?.addEventListener('input', ()=> applySkins(true));
    earthColorEl?.addEventListener('input', ()=> applySkins(true));

    // restore music preference
    const musicPref = localStorage.getItem('og_music');
    console.log('initUI: gefunden musicPref=', musicPref, 'musicToggleExists=', !!musicToggle);
    if (musicToggle && musicPref === 'false') { musicToggle.checked = false; }

    // open overlay by default (initial screen)
    overlay.classList.add('open');

    // settings button handlers
    if (settingsBtn && settingsModel){
        settingsBtn.addEventListener('click', ()=>{ settingsModel.classList.add('open'); drawEarthSprite(); });
    }
    // Start overlay: animated start and robust handlers (Start button + overlay 'start anywhere' toggle)
    const startFullOverlayBtn = document.getElementById('startFullOverlayBtn');
    function showStartDebug(msg){
        try{
            const dbg = document.getElementById('startDebug');
            if (dbg){ dbg.textContent = msg; dbg.style.opacity = '1'; setTimeout(()=> dbg.style.opacity = '0', 1600); }
        }catch(e){ console.log('debug show err', e); }
    }
    function triggerStartAnimation(){
        if (running) return; console.log('start animation trigger'); showStartDebug('Starte...'); overlay.classList.add('closing'); overlay.classList.remove('open');
        // brief delay for UI animation then start game
        setTimeout(()=>{ overlay.classList.add('hidden'); overlay.classList.remove('closing'); startGame(); }, 380);
    }
    if (overlay){
        overlay.addEventListener('pointerup', (e)=>{
            if (running) return;
            const startBtnEl = e.target.closest && e.target.closest('#startBtn');
            if (startBtnEl){ e.preventDefault(); e.stopPropagation(); triggerStartAnimation(); return; }
            // if enabled, clicking outside panel will start
            if (overlay.dataset.startAnywhere === 'true' && !e.target.closest('.start-panel')){ triggerStartAnimation(); }
        });
    }
    if (startFullOverlayBtn){
        startFullOverlayBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); overlay.dataset.startAnywhere = overlay.dataset.startAnywhere === 'true' ? 'false' : 'true'; startFullOverlayBtn.textContent = overlay.dataset.startAnywhere === 'true' ? 'START ANYWHERE ✓' : 'START ANYWHERE'; showStartDebug(overlay.dataset.startAnywhere === 'true' ? 'Start überall aktiviert' : 'Start überall deaktiviert'); });
    }
    // ensure start button uses the animated trigger
    if (startBtn){ startBtn.style.cursor = 'pointer'; startBtn.disabled = false; startBtn.setAttribute('aria-disabled','false'); startBtn.addEventListener('click', (e)=>{ console.log('startBtn clicked'); e.preventDefault(); startBtn.style.transform = 'scale(.98)'; playBeep(1200,0.06); setTimeout(()=> startBtn.style.transform = '', 120); triggerStartAnimation(); }); startBtn.addEventListener('pointerup', (e)=>{ console.log('startBtn pointerup'); e.preventDefault(); e.stopPropagation(); triggerStartAnimation(); }); startBtn.addEventListener('pointerdown', (e)=>{ e.stopPropagation(); }); }

    // keyboard support: Enter or Space to start when overlay is open
    window.addEventListener('keydown', (e)=>{ if (!running && (e.key === 'Enter' || e.key === ' ')) { if (overlay && !overlay.classList.contains('hidden')) triggerStartAnimation(); } });
    if (closeSettingsBtn){ closeSettingsBtn.addEventListener('click', ()=> settingsModel.classList.remove('open')); }
    if (saveSettingsBtn){ saveSettingsBtn.addEventListener('click', ()=>{
        localStorage.setItem('og_music', (musicToggle && musicToggle.checked) ? 'true' : 'false');
        if (musicToggle && musicToggle.checked){ startAudioIfNeeded(); startMusic(); } else { stopMusic(); }
        settingsModel.classList.remove('open');
    }); }

    if (musicToggle){
        musicToggle.addEventListener('change', ()=>{
            localStorage.setItem('og_music', musicToggle.checked ? 'true' : 'false');
            if (musicToggle.checked){ startAudioIfNeeded(); startMusic(); } else { stopMusic(); }
        });
    }

    // asteroid upload handler
    if (asteroidUpload){
        asteroidUpload.addEventListener('change', ()=>{
            const files = Array.from(asteroidUpload.files).slice(0,12);
            asteroidSprites.length = 0; // replace existing
            files.forEach(file => {
                const img = new Image();
                img.onload = ()=>{ asteroidSprites.push(img); console.log('Asteroid sprite loaded:', file.name); };
                img.src = URL.createObjectURL(file);
            });
        });
    }

    // volume control
    const savedVol = Number(localStorage.getItem('og_music_volume'));
    if (musicVolumeEl) { musicVolumeEl.value = !isNaN(savedVol) ? String(savedVol) : '0.35'; musicVolumeEl.addEventListener('input', ()=> setMusicVolume(musicVolumeEl.value)); }

    // input handlers
    if (dirBtn) dirBtn.addEventListener('pointerdown', (e)=>{ e.preventDefault(); tap(); }, { passive: false });
    if (shootBtn) shootBtn.addEventListener('pointerdown', (e)=>{ e.preventDefault(); shootOnce(true); }, { passive: false });
    window.addEventListener('keydown', (e)=>{ if (!running) return; if (e.code === 'Space') tap(); if (e.code === 'KeyF') shootOnce(true); if (e.code === 'KeyQ'){ // manual slow
            if (slowCharges > 0 && slowTimer <= 0){ slowCharges = Math.max(0, slowCharges - 1); slowTimer = slowDuration; timeScale = 0.4; slowCooldown = slowCooldownDuration; startAudioIfNeeded(); playMusicNote(440,0.22,'sine'); updatePowerUI(); screenShake = Math.max(screenShake, 12); }
        } });

    // user gesture to resume/start audio (required by browsers)
    const gestureStart = ()=>{
        console.log('gestureStart: Benutzer-Geste erkannt — Audio wird initialisiert');
        startAudioIfNeeded();
        if (musicToggle && musicToggle.checked) startMusic();
        window.removeEventListener('pointerdown', gestureStart);
    };
    window.addEventListener('pointerdown', gestureStart);
    // responsiveness: redraw earth on resize
    window.addEventListener('resize', ()=>{
        // resize main canvas logical buffer to match layout
        const newW = canvas.clientWidth;
        const newH = canvas.clientHeight;
        if (canvas.width !== newW || canvas.height !== newH){
            canvas.width = newW; canvas.height = newH;
        }
        // redraw earth sprite buffer to match CSS size
        drawEarthSprite();
        draw();
    });
})();