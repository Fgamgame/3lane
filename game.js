import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/loaders/GLTFLoader.js";

// =====================================
// 1. Three.js初期化
// =====================================
let scene, camera, renderer;
let ground;
const loader = new GLTFLoader();

function initThreeJS() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 5000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);
  
  // ライティング
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  let light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  scene.add(light);
  
  // 地面
  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 2000),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = 0;
  scene.add(ground);
  
  camera.position.set(0, 6, 10);
}

// =====================================
// 2. プレイヤー管理
// =====================================
let player;
let lane = 0;
let isJumping = false;
let isHovering = false;
let jumpVelocity = 0;
let jumpHeight = 5.5; // ジャンプの頂点までの高さ
let apexY = 0; // ジャンプターゲット
let hoverCounter = 0;
const hoverFrames = 15; // 約1秒分（60fps想定）
const gravity = -0.15;
const jumpVelocityInitial = 0.4; // 頂点に到達するまでの上昇速度

function loadPlayer() {
  loader.load("character.glb", (gltf) => {
    player = gltf.scene;
    player.scale.set(3, 3, 3);
    player.position.set(0, 0, -5);
    scene.add(player);
    
    camera.position.set(0, 6, 5);
    camera.lookAt(player.position);
    
    if (loadingDiv.parentNode) {
      loadingDiv.parentNode.removeChild(loadingDiv);
    }
  });
}

function updatePlayerPosition(gameSpeed) {
  if (!player) return;
  
  player.position.z -= gameSpeed;
  
  // 地面をプレイヤーに追従
  ground.position.z = player.position.z;
  
  // 横レーン移動
  player.position.x += (lane * 3 - player.position.x) * 0.2;
  
  // ジャンプ
  if (isJumping) {
    if (!isHovering && player.position.y < apexY) {
      player.position.y += jumpVelocity;
      if (player.position.y >= apexY) {
        player.position.y = apexY;
        isHovering = true;
        hoverCounter = hoverFrames;
        jumpVelocity = 0;
      }
    } else if (isHovering) {
      if (hoverCounter > 0) {
        hoverCounter--;
      } else {
        isHovering = false;
        jumpVelocity = 0;
      }
    } else {
      jumpVelocity += gravity;
      player.position.y += jumpVelocity;
    }

    if (player.position.y <= 0) {
      player.position.y = 0;
      isJumping = false;
      isHovering = false;
      jumpVelocity = 0;
      hoverCounter = 0;
      apexY = 0;
    }
  }
}

function updateCamera() {
  if (!player) return;
  camera.position.z = player.position.z + 10;
  camera.position.y = player.position.y + 6;
  camera.lookAt(player.position);
}

// =====================================
// 3. ゲート/オブジェクト管理
// =====================================
let gates = [];
let nextGateZ = -20;

const spawnRate = {
  hp: 0.2,    // HPブロック出現率 20%
  tree: 0.1,  // Tree（ジャンプ不可障害物）10%
  bush: 0.2,  // Bush（ジャンプで回避可能）20%
  coin: 0.5   // Coin（スコア獲得）50%
};

function createGate() {
  let x = (Math.floor(Math.random() * 3) - 1) * 3;
  let z_pos = nextGateZ;
  nextGateZ -= 25;
  
  let typeRand = Math.random();
  
  if (typeRand < spawnRate.hp) {
    createHPGate(x, z_pos);
  } else if (typeRand < spawnRate.hp + spawnRate.tree) {
    createTreeGate(x, z_pos);
  } else if (typeRand < spawnRate.hp + spawnRate.tree + spawnRate.coin) {
    createCoinGate(x, z_pos);
  } else {
    createBushGate(x, z_pos);
  }
}

function createHPGate(x, z_pos) {
  let hpStep = Math.floor(Math.random() * 4) + 1;
  let hpVal = (Math.random() > 0.5 ? 1 : -1) * hpStep * 5;
  
  loader.load("heart.glb", (gltf) => {
    let heart = gltf.scene;
    heart.position.set(x, 2, z_pos);
    heart.scale.set(0.1, 0.1, 0.1);
    heart.rotation.x = Math.PI / 2;
    heart.rotation.y = Math.PI / 1;
    heart.userData.type = "hp";
    heart.userData.value = hpVal;
    heart.userData.collected = false;
    heart.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
      }
    });
    scene.add(heart);
    gates.push(heart);
  });
}

function createTreeGate(x, z_pos) {
  let damage = Math.floor(Math.random() * 4) + 1;
  let treeVal = damage * 5;
  
  loader.load("Tree.glb", (gltf) => {
    let tree = gltf.scene;
    tree.position.set(x, 1.5, z_pos);
    tree.scale.set(0.5, 0.5, 0.5);
    tree.userData.type = "tree";
    tree.userData.value = treeVal;
    tree.userData.collected = false;
    scene.add(tree);
    gates.push(tree);
  });
}

function createCoinGate(x, z_pos) {
  let gate = new THREE.Mesh(
    new THREE.BoxGeometry(3, 3, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xffd700 })
  );
  gate.position.set(x, 1.5, z_pos);
  gate.userData.type = "coin";
  gate.userData.value = 10;
  gate.userData.collected = false;
  let label = createTextSprite("+10");
  label.position.set(0, 2, 0.3);
  gate.add(label);
  scene.add(gate);
  gates.push(gate);
}

function createBushGate(x, z_pos) {
  let damage = Math.floor(Math.random() * 4) + 1;
  let bushVal = damage * 5;
  
  loader.load("Bush.glb", (gltf) => {
    let bush = gltf.scene;
    bush.position.set(x, 1.5, z_pos);
    bush.scale.set(1.2, 1.2, 1.2);
    bush.userData.type = "bush";
    bush.userData.value = bushVal;
    bush.userData.collected = false;
    scene.add(bush);
    gates.push(bush);
  });
}

function removeDistantGates() {
  gates = gates.filter(gate => {
    if (!gate || !gate.position) return false;
    if (gate.position.z > player.position.z + 10) {
      scene.remove(gate);
      console.log("Removing gate");
      return false;
    }
    return true;
  });
}

function generateGates() {
  while (player && player.position.z - nextGateZ < 200 && gates.length < 50) {
    createGate();
  }
  
  gates = gates.filter(g => {
    if (g.userData.collected) {
      scene.remove(g);
      return false;
    }
    return true;
  });
}

// =====================================
// 4. パーティクル・ビジュアルエフェクト
// =====================================
function createTextSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.font = "bold 100px Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, 128, 150);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2, 2, 2);
  
  return sprite;
}

function createParticles(pos, color) {
  const geo = new THREE.BufferGeometry();
  let positions = [];
  
  for (let i = 0; i < 40; i++) {
    positions.push(
      pos.x + (Math.random() - 0.5),
      pos.y + Math.random(),
      pos.z + (Math.random() - 0.5)
    );
  }
  
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: color, size: 0.2 });
  const points = new THREE.Points(geo, mat);
  
  scene.add(points);
  setTimeout(() => scene.remove(points), 500);
}

// =====================================
// 5. ゲームロジック・ステータス
// =====================================
let score = 10;
const DEFAULT_MAX_HP = 5;
const COIN_STORAGE_KEY = "pg_saved_coin";
const MAX_HP_STORAGE_KEY = "pg_saved_max_hp";
const POOP_BUTTON_STORAGE_KEY = "pg_has_poop_button";
const HIGH_SCORES_STORAGE_KEY = "pg_high_scores";
const SHOP_PRICES = {
  maxHpIncrease: 30,
  poopButton: 80
};
const DEBUG_FREE_COIN_AMOUNT = 30;
const MAX_HP_UP_VALUE = 1;
const POOP_TARGET_ALTITUDE = 1000;
const POOP_FIELD_ALTITUDE = 975;
const POOP_FORWARD_OFFSET = -30;
const POOP_EFFECT_DURATION_MS = 3000;
const POOP_COOLDOWN_MS = 10000;
let maxHp = loadSavedMaxHp();
let hp = maxHp;
let coin = loadSavedCoin();
let lastScoreTime = 0;
let gameState = 'playing';
let gameSpeed = 0.25;
const gameSpeedIncreasePerFrame = 0.0002;
const maxGameSpeed = 1.4;
let framesSinceStart = 0;
let hasGameStarted = false;
let hasPoopButton = loadPoopButtonUnlocked();
let poopField = null;
let poopCooldownUntil = 0;
let savedPlayerPositionBeforePoop = null;

function loadSavedCoin() {
  try {
    const saved = localStorage.getItem(COIN_STORAGE_KEY);
    const parsed = Number.parseInt(saved ?? "0", 10);
    return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
  } catch (e) {
    return 0;
  }
}

function loadSavedMaxHp() {
  try {
    const saved = localStorage.getItem(MAX_HP_STORAGE_KEY);
    const parsed = Number.parseInt(saved ?? String(DEFAULT_MAX_HP), 10);
    if (Number.isNaN(parsed)) return DEFAULT_MAX_HP;
    return Math.max(DEFAULT_MAX_HP, parsed);
  } catch (e) {
    return DEFAULT_MAX_HP;
  }
}

function loadPoopButtonUnlocked() {
  try {
    return localStorage.getItem(POOP_BUTTON_STORAGE_KEY) === "1";
  } catch (e) {
    return false;
  }
}

function loadHighScores() {
  try {
    const saved = localStorage.getItem(HIGH_SCORES_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => Number.parseInt(v, 10))
      .filter((v) => !Number.isNaN(v) && v >= 0)
      .sort((a, b) => b - a)
      .slice(0, 3);
  } catch (e) {
    return [];
  }
}

function saveHighScores(scores) {
  try {
    localStorage.setItem(HIGH_SCORES_STORAGE_KEY, JSON.stringify(scores));
  } catch (e) {
    // storage is not available, ignore
  }
}

function registerHighScore(newScore) {
  const scores = loadHighScores();
  scores.push(Math.max(0, Math.floor(newScore)));
  scores.sort((a, b) => b - a);
  const top3 = scores.slice(0, 3);
  saveHighScores(top3);
}

function saveCoin() {
  try {
    localStorage.setItem(COIN_STORAGE_KEY, String(coin));
  } catch (e) {
    // storage is not available, ignore
  }
}

function saveMaxHp() {
  try {
    localStorage.setItem(MAX_HP_STORAGE_KEY, String(maxHp));
  } catch (e) {
    // storage is not available, ignore
  }
}

function savePoopButtonUnlocked(unlocked) {
  try {
    localStorage.setItem(POOP_BUTTON_STORAGE_KEY, unlocked ? "1" : "0");
  } catch (e) {
    // storage is not available, ignore
  }
}

function createPoopField() {
  if (poopField || !scene) return;

  const baseGeometry = new THREE.SphereGeometry(1, 24, 16);
  const poopMaterial = new THREE.MeshStandardMaterial({
    color: 0x5b3212,
    roughness: 0.9,
    metalness: 0.0
  });
  poopField = new THREE.Group();

  const bottom = new THREE.Mesh(baseGeometry, poopMaterial);
  bottom.scale.set(20, 9, 20);
  bottom.position.y = 0;
  poopField.add(bottom);

  const middle = new THREE.Mesh(baseGeometry, poopMaterial);
  middle.scale.set(14, 7, 14);
  middle.position.y = 7;
  poopField.add(middle);

  const top = new THREE.Mesh(baseGeometry, poopMaterial);
  top.scale.set(9, 5, 9);
  top.position.y = 12;
  poopField.add(top);

  scene.add(poopField);
}

function updatePoopFieldPosition() {
  if (!hasPoopButton || !player) return;
  if (!poopField) {
    createPoopField();
  }
  poopField.position.set(
    player.position.x,
    POOP_FIELD_ALTITUDE,
    player.position.z + POOP_FORWARD_OFFSET
  );
}

function activatePoopButton() {
  if (!hasPoopButton || !player || gameState !== "playing") return;
  const now = Date.now();
  if (now < poopCooldownUntil) return;

  poopCooldownUntil = now + POOP_COOLDOWN_MS;
  if (!poopField) {
    createPoopField();
  }

  savedPlayerPositionBeforePoop = player.position.clone();
  updatePoopFieldPosition();
  player.position.y = POOP_TARGET_ALTITUDE;
  // 空中移動にジャンプ状態が干渉しないようリセット
  isJumping = false;
  isHovering = false;
  jumpVelocity = 0;
  hoverCounter = 0;
  apexY = 0;

  setTimeout(() => {
    if (!player || !savedPlayerPositionBeforePoop) return;
    player.position.copy(savedPlayerPositionBeforePoop);
    savedPlayerPositionBeforePoop = null;
    isJumping = false;
    isHovering = false;
    jumpVelocity = 0;
    hoverCounter = 0;
    apexY = 0;
  }, POOP_EFFECT_DURATION_MS);
}

function updatePoopCooldownUI() {
  if (!poopCooldownDiv) return;
  if (!hasPoopButton) {
    poopCooldownDiv.innerText = "";
    return;
  }
  const remainMs = Math.max(0, poopCooldownUntil - Date.now());
  if (remainMs > 0) {
    poopCooldownDiv.innerText = `うんこクールタイム: ${(remainMs / 1000).toFixed(1)}s`;
  } else {
    poopCooldownDiv.innerText = "うんこクールタイム: Ready";
  }
}

export function getSavedCoin() {
  return loadSavedCoin();
}

export function getShopState() {
  return {
    coin: loadSavedCoin(),
    maxHp: loadSavedMaxHp(),
    hasPoopButton: loadPoopButtonUnlocked(),
    prices: { ...SHOP_PRICES }
  };
}

export function getHighScores() {
  return loadHighScores();
}

export function buyShopItem(itemId) {
  coin = loadSavedCoin();
  maxHp = loadSavedMaxHp();
  hasPoopButton = loadPoopButtonUnlocked();

  if (itemId === "maxHpIncrease") {
    if (coin < SHOP_PRICES.maxHpIncrease) {
      return { ok: false, message: "コインが足りません。" };
    }
    coin -= SHOP_PRICES.maxHpIncrease;
    maxHp += MAX_HP_UP_VALUE;
    saveCoin();
    saveMaxHp();
    if (hasGameStarted) {
      hp = Math.min(hp + MAX_HP_UP_VALUE, maxHp);
      updateUI();
    }
    return { ok: true, message: `HP上限が ${maxHp} になりました。` };
  }

  if (itemId === "poopButton") {
    if (hasPoopButton) {
      return { ok: false, message: "このアイテムは購入済みです。" };
    }
    if (coin < SHOP_PRICES.poopButton) {
      return { ok: false, message: "コインが足りません。" };
    }
    coin -= SHOP_PRICES.poopButton;
    saveCoin();
    savePoopButtonUnlocked(true);
    hasPoopButton = true;
    if (hasGameStarted) {
      createPoopField();
      updateUI();
    }
    return { ok: true, message: "うんこボタンを追加しました。Fキーで発動できます。" };
  }

  return { ok: false, message: "不明なアイテムです。" };
}

export function grantDebugCoin() {
  coin = loadSavedCoin();
  coin += DEBUG_FREE_COIN_AMOUNT;
  saveCoin();
  if (hasGameStarted) {
    updateUI();
  }
  return {
    ok: true,
    message: `デバッグで ${DEBUG_FREE_COIN_AMOUNT} coin を追加しました。`
  };
}

function updateUI() {
  document.getElementById("score").innerText = Math.floor(score);
  document.getElementById("coin").innerText = coin;
  const poopHint = hasPoopButton ? " | F:うんこ発動" : "";
  document.getElementById("hp").innerText = `${'❤️'.repeat(hp)} (${hp}/${maxHp})${poopHint}`;
}

function updateDebugSpeedText() {
  if (!debugSpeedDiv) return;
  debugSpeedDiv.innerText = `Speed: ${gameSpeed.toFixed(5)}\nAccel: +${gameSpeedIncreasePerFrame.toFixed(5)}/frame`;
}

function updateScore() {
  let currentTime = Date.now();
  if (currentTime - lastScoreTime >= 1000) {
    score = Math.floor(score + 1);
    lastScoreTime = currentTime;
    updateUI();
  }
  score += 0.03;
}

// =====================================
// 6. 衝突検出
// =====================================
function checkCollision() {
  if (!player) return;
  
  gates.forEach(g => {
    if (g.userData.collected) return;
    
    // Tree: 常に衝突（ジャンプ不可）
    if (g.userData.type == "tree") {
      if (
        Math.abs(player.position.z - g.position.z) < 1 &&
        Math.abs(player.position.x - g.position.x) < 1.5
      ) {
        hp -= 1;
        if (hp < 0) hp = 0;
        score = Math.floor(score);
        updateUI();
        createParticles(g.position, 0xff0000);
        scene.remove(g);
        g.userData.collected = true;
      }
      return;
    }
    
    // 他のブロック: 高さ判定有り（ジャンプで回避可能）
    if (
      Math.abs(player.position.z - g.position.z) < 1 &&
      Math.abs(player.position.x - g.position.x) < 1.5 &&
      player.position.y <= 0.8
    ) {
      if (g.userData.type == "coin") {
        coin += 1;
        saveCoin();
        score = Math.floor(score + g.userData.value);
      } else if (g.userData.type == "hp") {
        hp += 1;
        if (hp > maxHp) hp = maxHp;
      } else if (g.userData.type == "bush") {
        hp -= 1;
        if (hp < 0) hp = 0;
      }
      
      if (score < 0) score = 0;
      score = Math.floor(score);
      updateUI();
      
      let particleColor = 0x00aaff;
      if (g.userData.type == "coin") particleColor = 0xffd700;
      else if (g.userData.type == "hp") particleColor = (g.userData.value > 0 ? 0x00ff00 : 0xff0000);
      else if (g.userData.type == "bush") particleColor = 0xff0000;
      
      createParticles(g.position, particleColor);
      scene.remove(g);
      g.userData.collected = true;
    }
  });
}

// =====================================
// 7. ゲームオーバー管理
// =====================================
function showGameOver() {
  if (gameState === 'gameover') return;
  gameState = 'gameover';
  registerHighScore(score);
  document.getElementById("gameOverUI").style.display = "flex";
  document.getElementById("gameOverOverlay").style.display = "block";
  createGameOverParticles();
  playGameOverSound();
}

function hideGameOverOverlay() {
  document.getElementById("gameOverUI").style.display = "none";
  document.getElementById("gameOverOverlay").style.display = "none";
}

function createGameOverParticles() {
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const playerPos = player ? player.position : { x: 0, y: 2, z: 0 };
      createParticles({ x: playerPos.x, y: playerPos.y + 1, z: playerPos.z - 2 }, 0xff0000);
      createParticles({ x: playerPos.x, y: playerPos.y + 1, z: playerPos.z - 2 }, 0x00ff00);
    }, i * 80);
  }
}

function playGameOverSound() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ac.currentTime);
    gain.gain.setValueAtTime(0.2, ac.currentTime);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.frequency.exponentialRampToValueAtTime(30, ac.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6);
    osc.stop(ac.currentTime + 0.6);
  } catch (e) {
    // not supported, ignore
  }
}

function restartGame() {
  gameState = 'playing';
  hideGameOverOverlay();
  setTimeout(() => {
    location.reload();
  }, 400);
}

function returnToTitle() {
  location.href = location.pathname;
}

// =====================================
// 8. イベントリスナー
// =====================================
const loadingDiv = document.createElement("div");
loadingDiv.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);color:white;font-size:32px;z-index:999;";
loadingDiv.innerText = "Loading...";

const debugSpeedDiv = document.createElement("div");
debugSpeedDiv.style.cssText = "position:absolute;right:16px;top:16px;color:#9be7ff;background:rgba(0,0,0,0.45);padding:8px 10px;border:1px solid rgba(155,231,255,0.6);border-radius:6px;font:12px/1.4 monospace;white-space:pre;z-index:1000;pointer-events:none;";

const poopCooldownDiv = document.createElement("div");
poopCooldownDiv.style.cssText = "position:absolute;right:16px;top:86px;color:#ffd27a;background:rgba(0,0,0,0.45);padding:6px 10px;border:1px solid rgba(255,210,122,0.6);border-radius:6px;font:12px/1.4 monospace;z-index:1000;pointer-events:none;";

function setupEventListeners() {
  document.addEventListener("keydown", (e) => {
    if (e.key == "ArrowLeft") {
      if (lane > -1) lane -= 1;
    } else if (e.key == "ArrowRight") {
      if (lane < 1) lane += 1;
    } else if (e.key == " ") {
      if (!isJumping) {
        isJumping = true;
        jumpVelocity = jumpVelocityInitial;
        apexY = player.position.y + jumpHeight;
      }
    } else if (e.key === "f" || e.key === "F") {
      activatePoopButton();
    }
  });
  
  document.getElementById("restartBtn").addEventListener("click", restartGame);
  document.getElementById("titleBtn").addEventListener("click", returnToTitle);
}

// =====================================
// 9. ゲームループ
// =====================================
function animate() {
  requestAnimationFrame(animate);
  framesSinceStart++;
  gameSpeed = Math.min(gameSpeed + gameSpeedIncreasePerFrame, maxGameSpeed);
  updateDebugSpeedText();
  updatePoopCooldownUI();
  
  if (gameState === 'gameover') {
    renderer.render(scene, camera);
    return;
  }
  
  updateScore();
  updatePlayerPosition(gameSpeed);
  updatePoopFieldPosition();
  updateCamera();
  checkCollision();
  if (player && framesSinceStart > 5) {
    removeDistantGates();
  }
  generateGates();
  
  if (hp <= 0 && gameState === 'playing') {
    showGameOver();
  }
  
  renderer.render(scene, camera);
}

// =====================================
// 10. ゲーム開始
// =====================================
export function startGame() {
  if (hasGameStarted) return;
  hasGameStarted = true;
  coin = loadSavedCoin();
  maxHp = loadSavedMaxHp();
  hasPoopButton = loadPoopButtonUnlocked();
  hp = maxHp;
  if (!loadingDiv.parentNode) {
    document.body.appendChild(loadingDiv);
  }
  if (!debugSpeedDiv.parentNode) {
    document.body.appendChild(debugSpeedDiv);
  }
  if (!poopCooldownDiv.parentNode) {
    document.body.appendChild(poopCooldownDiv);
  }
  initThreeJS();
  if (hasPoopButton) {
    createPoopField();
  }
  loadPlayer();
  setupEventListeners();
  updateUI();
  
  // 初期ゲート生成
  for (let i = 0; i < 20; i++) createGate();
  
  animate();
}
