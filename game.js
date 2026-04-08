const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.getElementById("score"),
  level: document.getElementById("level"),
  clears: document.getElementById("clears"),
  highScore: document.getElementById("highScore"),
  overlay: document.getElementById("overlay"),
  overlayKicker: document.getElementById("overlayKicker"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  primaryButton: document.getElementById("primaryButton"),
  statusBanner: document.getElementById("statusBanner"),
  p1Card: document.getElementById("p1Card"),
  p1Lives: document.getElementById("p1Lives"),
  p1Weapon: document.getElementById("p1Weapon"),
  p1Power: document.getElementById("p1Power"),
  p1Shield: document.getElementById("p1Shield"),
  p1Status: document.getElementById("p1Status"),
  p2Card: document.getElementById("p2Card"),
  p2Lives: document.getElementById("p2Lives"),
  p2Weapon: document.getElementById("p2Weapon"),
  p2Power: document.getElementById("p2Power"),
  p2Shield: document.getElementById("p2Shield"),
  p2Status: document.getElementById("p2Status"),
};

const WORLD = {
  width: canvas.width,
  height: canvas.height,
};

const WEAPON_ORDER = ["pulse", "spread", "laser", "missile", "arc"];
const keys = new Set();

let stars = [];
let playerBullets = [];
let enemyBullets = [];
let enemies = [];
let powerUps = [];
let particles = [];
let floatingTexts = [];
let lastTime = 0;
let bannerTimer = 0;
let scoreSinceLevel = 0;
let nextEnemyId = 1;

const state = {
  running: false,
  paused: false,
  gameOver: false,
  score: 0,
  level: 1,
  clears: 0,
  highScore: Number(localStorage.getItem("plane-war-high-score") || 0),
  flash: 0,
  flashColor: "#ff6b87",
  enemySpawn: 0.7,
  powerSpawn: 10,
};

const WEAPONS = {
  pulse: {
    label: "脉冲",
    rate(level) {
      return Math.max(0.11, 0.26 - (level - 1) * 0.02);
    },
    fire(player) {
      spawnPlayerBullet(player, { offsetX: 0, offsetY: -18, vy: -700, radius: 4.3, damage: 1.05 });
      if (player.fireLevel >= 2) {
        spawnPlayerBullet(player, { offsetX: -11, offsetY: -8, vy: -690, radius: 4, damage: 0.95 });
        spawnPlayerBullet(player, { offsetX: 11, offsetY: -8, vy: -690, radius: 4, damage: 0.95 });
      }
      if (player.fireLevel >= 3) {
        spawnPlayerBullet(player, { offsetX: -18, offsetY: -4, vx: -45, vy: -675, radius: 3.7, damage: 0.9 });
        spawnPlayerBullet(player, { offsetX: 18, offsetY: -4, vx: 45, vy: -675, radius: 3.7, damage: 0.9 });
      }
      if (player.fireLevel >= 4) {
        spawnPlayerBullet(player, { offsetX: -26, offsetY: 2, vx: -85, vy: -660, radius: 3.5, damage: 0.85 });
        spawnPlayerBullet(player, { offsetX: 26, offsetY: 2, vx: 85, vy: -660, radius: 3.5, damage: 0.85 });
      }
      if (player.fireLevel >= 5) {
        spawnPlayerBullet(player, { offsetX: 0, offsetY: -26, vy: -760, radius: 4.6, damage: 1.35, color: "#ffffff" });
      }
    },
  },
  spread: {
    label: "散射",
    rate(level) {
      return Math.max(0.15, 0.34 - level * 0.018);
    },
    fire(player) {
      const count = Math.min(8, 3 + player.fireLevel);
      const spread = 0.42 + player.fireLevel * 0.04;
      for (let index = 0; index < count; index += 1) {
        const t = count === 1 ? 0.5 : index / (count - 1);
        const angle = -Math.PI / 2 + (t - 0.5) * spread;
        const speed = 600 + player.fireLevel * 22;
        spawnPlayerBullet(player, {
          offsetX: (t - 0.5) * 22,
          offsetY: -12,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 3.7,
          damage: 0.82,
        });
      }
    },
  },
  laser: {
    label: "激光",
    rate(level) {
      return Math.max(0.09, 0.2 - level * 0.012);
    },
    fire(player) {
      const offsets =
        player.fireLevel >= 4 ? [-18, 0, 18] : player.fireLevel >= 2 ? [-10, 10] : [0];
      for (const offset of offsets) {
        spawnPlayerBullet(player, {
          offsetX: offset,
          offsetY: -18,
          vy: -980,
          radius: 4,
          damage: 1.35 + player.fireLevel * 0.32,
          color: "#ffe07a",
          kind: "laser",
          maxAge: 0.72,
          pierce: 2 + Math.floor(player.fireLevel / 2),
        });
      }
    },
  },
  missile: {
    label: "追踪弹",
    rate(level) {
      return Math.max(0.22, 0.52 - level * 0.038);
    },
    fire(player) {
      const offsets = player.fireLevel >= 5 ? [-20, 0, 20] : player.fireLevel >= 3 ? [-14, 14] : [0];
      for (const offset of offsets) {
        spawnPlayerBullet(player, {
          offsetX: offset,
          offsetY: -10,
          vx: offset * 5,
          vy: -340,
          radius: 5.2,
          damage: 2.1 + player.fireLevel * 0.34,
          color: "#ffb45b",
          kind: "missile",
          maxAge: 2.8,
          homing: 3.2 + player.fireLevel * 0.42,
          pierce: 1,
        });
      }
    },
  },
  arc: {
    label: "电弧",
    rate(level) {
      return Math.max(0.13, 0.3 - level * 0.018);
    },
    fire(player) {
      const count = 2 + Math.floor(player.fireLevel / 2);
      for (let index = 0; index < count; index += 1) {
        const spread = count === 1 ? 0 : index / (count - 1) - 0.5;
        spawnPlayerBullet(player, {
          offsetX: spread * 26,
          offsetY: -12,
          vx: spread * 120,
          vy: -560,
          radius: 5,
          damage: 1.08,
          color: "#77efb4",
          kind: "arc",
          maxAge: 1.8,
          waveAmp: 24 + player.fireLevel * 3,
          waveFreq: 8 + index * 1.4,
          phase: player.fireLevel + index,
        });
      }
    },
  },
};

const ENEMY_DEFS = {
  scout: {
    width: 28,
    height: 36,
    hp(level) {
      return 1 + Math.floor(level / 4);
    },
    speed(level) {
      return 180 + level * 12 + Math.random() * 55;
    },
    score(level) {
      return 90 + level * 8;
    },
    color: "#ff90a3",
    drift: 56,
    shooter: false,
  },
  striker: {
    width: 36,
    height: 44,
    hp(level) {
      return 2 + Math.floor(level / 2);
    },
    speed(level) {
      return 165 + level * 10 + Math.random() * 45;
    },
    score(level) {
      return 160 + level * 18;
    },
    color: "#ffbd72",
    drift: 70,
    shooter: true,
  },
  interceptor: {
    width: 38,
    height: 42,
    hp(level) {
      return 3 + Math.floor(level / 2);
    },
    speed(level) {
      return 220 + level * 13 + Math.random() * 40;
    },
    score(level) {
      return 230 + level * 24;
    },
    color: "#6fd8ff",
    drift: 118,
    shooter: true,
  },
  turret: {
    width: 48,
    height: 56,
    hp(level) {
      return 6 + level;
    },
    speed(level) {
      return 110 + level * 6 + Math.random() * 24;
    },
    score(level) {
      return 360 + level * 30;
    },
    color: "#8be07f",
    drift: 44,
    shooter: true,
  },
  bomber: {
    width: 60,
    height: 70,
    hp(level) {
      return 11 + level * 2;
    },
    speed(level) {
      return 88 + level * 5 + Math.random() * 18;
    },
    score(level) {
      return 620 + level * 46;
    },
    color: "#ff7c65",
    drift: 50,
    shooter: true,
  },
  ace: {
    width: 70,
    height: 82,
    hp(level) {
      return 18 + level * 3;
    },
    speed(level) {
      return 108 + level * 7 + Math.random() * 18;
    },
    score(level) {
      return 980 + level * 68;
    },
    color: "#75cfff",
    drift: 68,
    shooter: true,
  },
};

const players = [
  createPlayer({
    id: "p1",
    label: "P1",
    name: "蓝翼号",
    accent: "#7ef9ff",
    hull: "#5caeff",
    controls: { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS" },
    startX: WORLD.width * 0.34,
    startWeapon: "pulse",
  }),
  createPlayer({
    id: "p2",
    label: "P2",
    name: "赤焰号",
    accent: "#ff9ab2",
    hull: "#ffbf63",
    controls: { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" },
    startX: WORLD.width * 0.66,
    startWeapon: "spread",
  }),
];

ui.highScore.textContent = String(state.highScore);

function createPlayer(config) {
  return {
    ...config,
    x: config.startX,
    y: WORLD.height - 110,
    width: 42,
    height: 54,
    speed: 355,
    cooldown: 0,
    hitCooldown: 0,
    shield: 0,
    fireLevel: 1,
    weaponType: config.startWeapon,
    lives: 3,
    alive: true,
    respawnTimer: 0,
    kills: 0,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function getLevelThreshold(level) {
  return 1400 + (level - 1) * 950;
}

function chooseWeighted(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.type;
    }
  }
  return entries[entries.length - 1].type;
}

function initStars() {
  stars = Array.from({ length: 110 }, () => ({
    x: Math.random() * WORLD.width,
    y: Math.random() * WORLD.height,
    size: Math.random() * 2.2 + 0.5,
    speed: Math.random() * 85 + 24,
    alpha: Math.random() * 0.68 + 0.14,
  }));
}

function livingPlayers() {
  return players.filter((player) => player.alive);
}

function allPilotsOut() {
  return players.every((player) => !player.alive && player.lives <= 0 && player.respawnTimer <= 0);
}

function setOverlay(visible, options = {}) {
  ui.overlay.classList.toggle("visible", visible);
  if (options.kicker) {
    ui.overlayKicker.textContent = options.kicker;
  }
  if (options.title) {
    ui.overlayTitle.textContent = options.title;
  }
  if (options.text) {
    ui.overlayText.textContent = options.text;
  }
  if (options.buttonText) {
    ui.primaryButton.textContent = options.buttonText;
  }
}

function flashMessage(text, duration = 1.8) {
  ui.statusBanner.textContent = text;
  ui.statusBanner.classList.add("visible");
  bannerTimer = duration;
}

function resetPlayer(player, resetWeapon = false) {
  player.x = player.startX;
  player.y = WORLD.height - 110;
  player.cooldown = Math.random() * 0.12;
  player.hitCooldown = 0.8;
  player.shield = Math.max(player.shield, 1);
  player.fireLevel = resetWeapon ? 1 : player.fireLevel;
  player.weaponType = resetWeapon ? player.startWeapon : player.weaponType;
  player.alive = true;
  player.respawnTimer = 0;
}

function resetGame() {
  state.running = true;
  state.paused = false;
  state.gameOver = false;
  state.score = 0;
  state.level = 1;
  state.clears = 0;
  state.flash = 0;
  state.flashColor = "#ff6b87";
  state.enemySpawn = 0.75;
  state.powerSpawn = 8.5;
  scoreSinceLevel = 0;
  nextEnemyId = 1;

  playerBullets = [];
  enemyBullets = [];
  enemies = [];
  powerUps = [];
  particles = [];
  floatingTexts = [];

  for (const player of players) {
    player.lives = 3;
    player.shield = 0;
    player.fireLevel = 1;
    player.weaponType = player.startWeapon;
    player.kills = 0;
    resetPlayer(player, false);
    player.hitCooldown = 0.95;
    player.shield = 1;
  }

  updateHud();
  setOverlay(false);
  flashMessage("双机编队已升空");
}

function addScore(amount) {
  state.score += amount;
  scoreSinceLevel += amount;
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem("plane-war-high-score", String(state.highScore));
  }

  while (scoreSinceLevel >= getLevelThreshold(state.level)) {
    scoreSinceLevel -= getLevelThreshold(state.level);
    state.level += 1;
    flashMessage(`威胁等级提升至 Lv.${state.level}`);
  }
}

function updateHud() {
  ui.score.textContent = String(state.score);
  ui.level.textContent = String(state.level);
  ui.clears.textContent = String(state.clears);
  ui.highScore.textContent = String(state.highScore);

  for (const player of players) {
    const prefix = player.id;
    const status = player.alive
      ? "作战中"
      : player.lives > 0
        ? `返场 ${Math.max(0, player.respawnTimer).toFixed(1)}s`
        : "离场";

    ui[`${prefix}Lives`].textContent = String(player.lives);
    ui[`${prefix}Weapon`].textContent = WEAPONS[player.weaponType].label;
    ui[`${prefix}Power`].textContent = `Lv.${player.fireLevel}`;
    ui[`${prefix}Shield`].textContent = String(player.shield);
    ui[`${prefix}Status`].textContent = status;
    ui[`${prefix}Card`].classList.toggle("pilot-card-down", !player.alive);
    ui[`${prefix}Card`].classList.toggle("pilot-card-out", !player.alive && player.lives <= 0);
  }
}

function spawnPlayerBullet(player, options) {
  playerBullets.push({
    ownerId: player.id,
    x: player.x + (options.offsetX || 0),
    y: player.y + (options.offsetY || 0),
    vx: options.vx || 0,
    vy: options.vy || -640,
    radius: options.radius || 4,
    damage: options.damage || 1,
    color: options.color || player.accent,
    kind: options.kind || "bullet",
    maxAge: options.maxAge || 1.4,
    age: 0,
    pierce: options.pierce || 1,
    homing: options.homing || 0,
    waveAmp: options.waveAmp || 0,
    waveFreq: options.waveFreq || 0,
    phase: options.phase || 0,
    hitIds: new Set(),
  });
}

function getEnemyPool() {
  const pool = [
    { type: "scout", weight: state.level < 3 ? 38 : 22 },
    { type: "striker", weight: 26 },
  ];
  if (state.level >= 2) {
    pool.push({ type: "interceptor", weight: 20 });
  }
  if (state.level >= 3) {
    pool.push({ type: "turret", weight: 16 });
  }
  if (state.level >= 4) {
    pool.push({ type: "bomber", weight: 11 });
  }
  if (state.level >= 5) {
    pool.push({ type: "ace", weight: 7 + Math.min(7, state.level - 5) });
  }
  return pool;
}

function createEnemy(type, forcedX) {
  const def = ENEMY_DEFS[type];
  const hp = def.hp(state.level);

  return {
    id: nextEnemyId++,
    type,
    x: forcedX ?? randomRange(50, WORLD.width - 50),
    y: -def.height - Math.random() * 70,
    width: def.width,
    height: def.height,
    hp,
    maxHp: hp,
    speed: def.speed(state.level),
    score: def.score(state.level),
    color: def.color,
    drift: def.drift * (Math.random() > 0.5 ? 1 : -1),
    shooter: def.shooter,
    shootTimer: def.shooter ? getEnemyCooldown(type) : Infinity,
    phase: Math.random() * Math.PI * 2,
    age: 0,
    dashDir: Math.random() > 0.5 ? 1 : -1,
    hoverY: randomRange(120, 260),
  };
}

function spawnEnemyWave() {
  const type = chooseWeighted(getEnemyPool());
  const count =
    type === "scout"
      ? 1 + (Math.random() > 0.45 ? 1 : 0) + (state.level >= 5 && Math.random() > 0.7 ? 1 : 0)
      : type === "interceptor" && state.level >= 4 && Math.random() > 0.6
        ? 2
        : 1;

  const center = randomRange(80, WORLD.width - 80);
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * 58;
    enemies.push(createEnemy(type, clamp(center + offset, 40, WORLD.width - 40)));
  }
}

function getEnemyCooldown(type) {
  if (type === "striker") {
    return Math.max(1.05, 1.75 - state.level * 0.04) + Math.random() * 0.35;
  }
  if (type === "interceptor") {
    return Math.max(1.25, 2.05 - state.level * 0.05) + Math.random() * 0.45;
  }
  if (type === "turret") {
    return Math.max(1.15, 1.95 - state.level * 0.04) + Math.random() * 0.3;
  }
  if (type === "bomber") {
    return Math.max(1.4, 2.45 - state.level * 0.04) + Math.random() * 0.45;
  }
  if (type === "ace") {
    return Math.max(0.78, 1.42 - state.level * 0.04) + Math.random() * 0.28;
  }
  return Infinity;
}

function getNearestLivingPlayer(x, y) {
  const active = livingPlayers();
  if (active.length === 0) {
    return null;
  }

  let nearest = active[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const player of active) {
    const dx = player.x - x;
    const dy = player.y - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = player;
    }
  }

  return nearest;
}

function getNearestEnemy(x, y) {
  if (enemies.length === 0) {
    return null;
  }

  let nearest = enemies[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    if (enemy.dead) {
      continue;
    }
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = enemy;
    }
  }

  return nearest;
}

function spawnEnemyBullet(x, y, options) {
  enemyBullets.push({
    x,
    y,
    vx: options.vx,
    vy: options.vy,
    radius: options.radius || 4,
    color: options.color || "#ff7f98",
    damage: options.damage || 1,
    maxAge: options.maxAge || 4.8,
    age: 0,
    gravity: options.gravity || 0,
    kind: options.kind || "shot",
  });
}

function fireAimedPattern(enemy, count, spread, speed, color, radius = 4) {
  const target = getNearestLivingPlayer(enemy.x, enemy.y);
  if (!target) {
    return;
  }

  const baseAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const angle = baseAngle + (t - 0.5) * spread;
    spawnEnemyBullet(enemy.x, enemy.y + enemy.height / 2 - 6, {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      color,
    });
  }
}

function fireFanPattern(enemy, count, spread, speed, color, radius = 4, kind = "shot") {
  const baseAngle = Math.PI / 2;
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const angle = baseAngle + (t - 0.5) * spread;
    spawnEnemyBullet(enemy.x, enemy.y + enemy.height / 2 - 4, {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      color,
      kind,
    });
  }
}

function fireEnemyWeapon(enemy) {
  if (!enemy.shooter || livingPlayers().length === 0) {
    return;
  }

  if (enemy.type === "striker") {
    fireAimedPattern(enemy, 1, 0, 270 + state.level * 10, "#ff9a76", 4);
    return;
  }

  if (enemy.type === "interceptor") {
    fireAimedPattern(enemy, 2, 0.16, 305 + state.level * 11, "#6fd8ff", 3.8);
    return;
  }

  if (enemy.type === "turret") {
    fireFanPattern(enemy, state.level >= 5 ? 5 : 3, 0.75, 260 + state.level * 8, "#9eec85", 4);
    return;
  }

  if (enemy.type === "bomber") {
    spawnEnemyBullet(enemy.x, enemy.y + enemy.height / 2 - 2, {
      vx: Math.sin(enemy.phase) * 22,
      vy: 215 + state.level * 9,
      radius: 7,
      color: "#ff865d",
      gravity: 36,
      kind: "bomb",
    });
    fireFanPattern(enemy, 2, 0.42, 205, "#ffbf77", 3.2);
    return;
  }

  if (enemy.type === "ace") {
    fireAimedPattern(enemy, state.level >= 7 ? 5 : 3, 0.34, 320 + state.level * 12, "#ffe182", 4.3);
  }
}

function choosePowerUpType() {
  return chooseWeighted([
    { type: "fire", weight: 30 },
    { type: "weapon", weight: 27 },
    { type: "shield", weight: 23 },
    { type: "heal", weight: 20 },
  ]);
}

function spawnPowerUp(x, y, forcedType) {
  powerUps.push({
    type: forcedType || choosePowerUpType(),
    x,
    y,
    width: 22,
    height: 22,
    speed: 122,
    bob: Math.random() * Math.PI * 2,
  });
}

function spawnExplosion(x, y, color, count = 14) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.25;
    const speed = 60 + Math.random() * 190;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 4 + 1.3,
      life: 0.45 + Math.random() * 0.45,
      maxLife: 0.9,
      color,
    });
  }
}

function spawnFloatingText(text, x, y, color) {
  floatingTexts.push({
    text,
    x,
    y,
    color,
    life: 0.9,
  });
}

function setScreenFlash(color, amount) {
  state.flashColor = color;
  state.flash = Math.max(state.flash, amount);
}

function takeDamage(player) {
  if (!player.alive || player.hitCooldown > 0) {
    return;
  }

  if (player.shield > 0) {
    player.shield -= 1;
    player.hitCooldown = 0.5;
    setScreenFlash(player.accent, 0.22);
    flashMessage(`${player.label} 的护盾抵消了一次伤害`, 1.4);
    spawnExplosion(player.x, player.y, player.accent, 10);
    updateHud();
    return;
  }

  player.lives = Math.max(0, player.lives - 1);
  player.alive = false;
  player.respawnTimer = player.lives > 0 ? 1.5 : 0;
  player.hitCooldown = 0;
  player.fireLevel = Math.max(1, player.fireLevel - 1);
  setScreenFlash(player.accent, 0.34);
  spawnExplosion(player.x, player.y, player.accent, 22);

  if (player.lives > 0) {
    flashMessage(`${player.label} 被击落，正在重新部署`, 1.5);
  } else {
    flashMessage(`${player.label} 已退出战斗`, 1.8);
  }

  updateHud();
  if (allPilotsOut()) {
    endGame();
  }
}

function pickDifferentWeapon(currentWeapon) {
  const choices = WEAPON_ORDER.filter((type) => type !== currentWeapon);
  return choices[Math.floor(Math.random() * choices.length)];
}

function applyPowerUp(player, powerType) {
  if (powerType === "fire") {
    player.fireLevel = Math.min(5, player.fireLevel + 1);
    flashMessage(`${player.label} 火力提升到 Lv.${player.fireLevel}`);
    spawnFloatingText(`${player.label} 火力+1`, player.x, player.y - 24, "#ffc65a");
  } else if (powerType === "weapon") {
    player.weaponType = pickDifferentWeapon(player.weaponType);
    player.fireLevel = Math.min(5, player.fireLevel + 1);
    flashMessage(`${player.label} 切换为 ${WEAPONS[player.weaponType].label}`);
    spawnFloatingText(WEAPONS[player.weaponType].label, player.x, player.y - 24, "#7ef9ff");
  } else if (powerType === "shield") {
    player.shield = Math.min(3, player.shield + 1);
    flashMessage(`${player.label} 获得护盾`);
    spawnFloatingText("护盾启动", player.x, player.y - 24, "#7ef9ff");
  } else if (powerType === "heal") {
    player.lives = Math.min(5, player.lives + 1);
    flashMessage(`${player.label} 恢复了一条命`);
    spawnFloatingText("机体修复", player.x, player.y - 24, "#3ee0a8");
  }
  updateHud();
}

function destroyEnemy(enemy, ownerId) {
  if (enemy.dead) {
    return;
  }

  enemy.dead = true;
  state.clears += 1;
  addScore(enemy.score);
  const owner = players.find((player) => player.id === ownerId);
  if (owner) {
    owner.kills += 1;
  }

  spawnExplosion(enemy.x, enemy.y, enemy.color, enemy.type === "ace" ? 28 : enemy.type === "bomber" ? 24 : 16);
  spawnFloatingText(`+${enemy.score}`, enemy.x, enemy.y, enemy.color);

  const guaranteedDrop = enemy.type === "ace" || enemy.type === "bomber";
  if (guaranteedDrop || Math.random() > 0.75) {
    spawnPowerUp(enemy.x, enemy.y);
  }
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  setOverlay(true, {
    kicker: "编队失联",
    title: "双人任务结束",
    text: `本局总分 ${state.score}，击坠 ${state.clears} 架敌机，最高分 ${state.highScore}。按空格或点击按钮重新出击。`,
    buttonText: "重新出击",
  });
}

function pauseGame() {
  if (!state.running || state.gameOver) {
    return;
  }

  state.paused = !state.paused;
  setOverlay(state.paused, {
    kicker: "已暂停",
    title: "编队待命中",
    text: "按 P 键继续推进，或点击按钮立刻回到战场。",
    buttonText: "继续战斗",
  });
}

function clampPlayer(player) {
  player.x = clamp(player.x, player.width / 2, WORLD.width - player.width / 2);
  player.y = clamp(player.y, player.height / 2, WORLD.height - player.height / 2);
}

function updatePlayers(delta) {
  for (const player of players) {
    if (player.hitCooldown > 0) {
      player.hitCooldown -= delta;
    }

    if (!player.alive) {
      if (player.respawnTimer > 0) {
        player.respawnTimer -= delta;
        if (player.respawnTimer <= 0 && player.lives > 0) {
          resetPlayer(player, false);
          flashMessage(`${player.label} 重返战场`, 1.3);
          spawnExplosion(player.x, player.y, player.accent, 10);
        }
      }
      continue;
    }

    const horizontal =
      (keys.has(player.controls.right) ? 1 : 0) - (keys.has(player.controls.left) ? 1 : 0);
    const vertical =
      (keys.has(player.controls.down) ? 1 : 0) - (keys.has(player.controls.up) ? 1 : 0);

    player.x += horizontal * player.speed * delta;
    player.y += vertical * player.speed * delta;
    clampPlayer(player);

    player.cooldown -= delta;
    if (player.cooldown <= 0) {
      WEAPONS[player.weaponType].fire(player);
      player.cooldown = WEAPONS[player.weaponType].rate(player.fireLevel);
    }
  }
}

function updateStars(delta) {
  for (const star of stars) {
    star.y += star.speed * delta;
    if (star.y > WORLD.height) {
      star.y = -4;
      star.x = Math.random() * WORLD.width;
      star.size = Math.random() * 2.2 + 0.5;
    }
  }
}

function updatePlayerBullets(delta) {
  playerBullets = playerBullets.filter((bullet) => {
    bullet.age += delta;

    if (bullet.kind === "missile") {
      const target = getNearestEnemy(bullet.x, bullet.y);
      if (target) {
        const dx = target.x - bullet.x;
        const dy = target.y - bullet.y;
        const length = Math.hypot(dx, dy) || 1;
        const desiredVx = (dx / length) * 360;
        const desiredVy = (dy / length) * 360;
        bullet.vx += (desiredVx - bullet.vx) * Math.min(1, bullet.homing * delta);
        bullet.vy += (desiredVy - bullet.vy) * Math.min(1, bullet.homing * delta);
      }
    }

    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;

    if (bullet.kind === "arc") {
      bullet.x += Math.sin(bullet.age * bullet.waveFreq + bullet.phase) * bullet.waveAmp * delta;
    }

    return (
      bullet.age < bullet.maxAge &&
      bullet.y > -80 &&
      bullet.y < WORLD.height + 80 &&
      bullet.x > -80 &&
      bullet.x < WORLD.width + 80 &&
      !bullet.hit
    );
  });
}

function updateEnemyBullets(delta) {
  enemyBullets = enemyBullets.filter((bullet) => {
    bullet.age += delta;
    bullet.vy += bullet.gravity * delta;
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;

    return (
      bullet.age < bullet.maxAge &&
      bullet.y > -60 &&
      bullet.y < WORLD.height + 80 &&
      bullet.x > -80 &&
      bullet.x < WORLD.width + 80 &&
      !bullet.hit
    );
  });
}

function updateEnemies(delta) {
  state.enemySpawn -= delta;
  const nextSpawn = Math.max(0.26, 0.92 - state.level * 0.052) + Math.random() * 0.34;
  if (state.enemySpawn <= 0) {
    spawnEnemyWave();
    state.enemySpawn = nextSpawn;
  }

  state.powerSpawn -= delta;
  if (state.powerSpawn <= 0) {
    spawnPowerUp(randomRange(60, WORLD.width - 60), -20);
    state.powerSpawn = 10 + Math.random() * 6;
    flashMessage("补给舱进入战场", 1.2);
  }

  enemies = enemies.filter((enemy) => {
    enemy.age += delta;
    enemy.phase += delta * (1.7 + enemy.speed / 130);

    if (enemy.type === "scout") {
      enemy.y += enemy.speed * delta;
      enemy.x += Math.sin(enemy.phase * 1.8) * enemy.drift * delta;
    } else if (enemy.type === "striker") {
      enemy.y += enemy.speed * delta * 0.92;
      enemy.x += Math.sin(enemy.phase * 2.4) * enemy.drift * 1.08 * delta;
    } else if (enemy.type === "interceptor") {
      enemy.y += enemy.speed * delta;
      enemy.x += enemy.dashDir * 130 * delta + Math.sin(enemy.phase * 3) * 26 * delta;
      if (enemy.x < enemy.width / 2 || enemy.x > WORLD.width - enemy.width / 2) {
        enemy.dashDir *= -1;
      }
    } else if (enemy.type === "turret") {
      if (enemy.y < enemy.hoverY) {
        enemy.y += enemy.speed * delta;
      } else {
        enemy.y += 16 * delta + Math.sin(enemy.phase * 1.3) * 8 * delta;
      }
      enemy.x += Math.sin(enemy.phase) * enemy.drift * 0.3 * delta;
    } else if (enemy.type === "bomber") {
      enemy.y += enemy.speed * delta * 0.78;
      enemy.x += Math.sin(enemy.phase * 0.8) * enemy.drift * 0.34 * delta;
    } else if (enemy.type === "ace") {
      enemy.y += enemy.y < 165 ? enemy.speed * delta : enemy.speed * 0.38 * delta;
      enemy.x += Math.sin(enemy.phase * 1.55) * enemy.drift * 0.72 * delta;
    }

    enemy.x = clamp(enemy.x, enemy.width / 2 - 10, WORLD.width - enemy.width / 2 + 10);

    if (enemy.shooter) {
      enemy.shootTimer -= delta;
      if (enemy.shootTimer <= 0) {
        fireEnemyWeapon(enemy);
        enemy.shootTimer = getEnemyCooldown(enemy.type);
      }
    }

    return !enemy.dead && enemy.y < WORLD.height + enemy.height + 60;
  });
}

function updatePowerUps(delta) {
  powerUps = powerUps.filter((power) => {
    power.bob += delta * 4;
    power.y += power.speed * delta;
    power.x += Math.sin(power.bob) * 26 * delta;

    for (const player of players) {
      if (!player.alive) {
        continue;
      }

      if (intersects(power, player)) {
        applyPowerUp(player, power.type);
        return false;
      }
    }

    return power.y < WORLD.height + 40;
  });
}

function updateParticles(delta) {
  particles = particles.filter((particle) => {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    return particle.life > 0;
  });

  floatingTexts = floatingTexts.filter((item) => {
    item.life -= delta;
    item.y -= 34 * delta;
    return item.life > 0;
  });
}

function collidesCircleRect(circle, rect) {
  const nearestX = Math.max(rect.x - rect.width / 2, Math.min(circle.x, rect.x + rect.width / 2));
  const nearestY = Math.max(rect.y - rect.height / 2, Math.min(circle.y, rect.y + rect.height / 2));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function intersects(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width &&
    Math.abs(a.y - b.y) * 2 < a.height + b.height
  );
}

function handleCollisions() {
  for (const bullet of playerBullets) {
    for (const enemy of enemies) {
      if (enemy.dead || bullet.hitIds.has(enemy.id) || !collidesCircleRect(bullet, enemy)) {
        continue;
      }

      bullet.hitIds.add(enemy.id);
      enemy.hp -= bullet.damage;
      bullet.pierce -= 1;
      spawnExplosion(bullet.x, bullet.y, bullet.color, bullet.kind === "laser" ? 3 : 5);

      if (bullet.kind === "missile") {
        spawnExplosion(bullet.x, bullet.y, "#ffcf7a", 8);
      }

      if (enemy.hp <= 0) {
        destroyEnemy(enemy, bullet.ownerId);
      }

      if (bullet.pierce <= 0) {
        bullet.hit = true;
      }

      break;
    }
  }

  playerBullets = playerBullets.filter((bullet) => !bullet.hit);
  enemies = enemies.filter((enemy) => !enemy.dead);

  for (const bullet of enemyBullets) {
    for (const player of players) {
      if (!player.alive || !collidesCircleRect(bullet, player)) {
        continue;
      }
      bullet.hit = true;
      takeDamage(player);
      break;
    }
  }

  enemyBullets = enemyBullets.filter((bullet) => !bullet.hit);

  for (const enemy of enemies) {
    for (const player of players) {
      if (!player.alive || !intersects(enemy, player)) {
        continue;
      }
      enemy.dead = true;
      spawnExplosion(enemy.x, enemy.y, enemy.color, enemy.type === "ace" ? 26 : 14);
      takeDamage(player);
      break;
    }
  }

  enemies = enemies.filter((enemy) => !enemy.dead);
}

function updateBanner(delta) {
  if (bannerTimer > 0) {
    bannerTimer -= delta;
    if (bannerTimer <= 0) {
      ui.statusBanner.classList.remove("visible");
    }
  }
}

function update(delta) {
  updateStars(delta);

  if (!state.running || state.paused) {
    updateBanner(delta);
    updateHud();
    return;
  }

  updatePlayers(delta);
  updatePlayerBullets(delta);
  updateEnemyBullets(delta);
  updateEnemies(delta);
  updatePowerUps(delta);
  updateParticles(delta);
  handleCollisions();
  updateBanner(delta);

  state.flash = Math.max(0, state.flash - delta);
  updateHud();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  gradient.addColorStop(0, "#071427");
  gradient.addColorStop(0.56, "#040d18");
  gradient.addColorStop(1, "#02060d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#d7f0ff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#9ccfff";
  for (let row = 0; row < 10; row += 1) {
    const y = row * 88 + ((Date.now() / 38) % 88);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(player) {
  if (!player.alive) {
    return;
  }

  ctx.save();
  ctx.translate(player.x, player.y);

  if (player.hitCooldown > 0 && Math.sin(player.hitCooldown * 28) > 0) {
    ctx.globalAlpha = 0.45;
  }

  if (player.shield > 0) {
    ctx.strokeStyle = `${player.accent}aa`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 34 + player.shield * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = player.hull;
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(18, 14);
  ctx.lineTo(10, 10);
  ctx.lineTo(7, 24);
  ctx.lineTo(-7, 24);
  ctx.lineTo(-10, 10);
  ctx.lineTo(-18, 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = player.accent;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(7, 9);
  ctx.lineTo(-7, 9);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ff9b5d";
  ctx.fillRect(-8, 22, 5, 13);
  ctx.fillRect(3, 22, 5, 13);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px Bahnschrift, Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(player.label, 0, -38);
  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = enemy.color;

  if (enemy.type === "scout") {
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(14, -10);
    ctx.lineTo(0, -18);
    ctx.lineTo(-14, -10);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.type === "striker") {
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(18, 2);
    ctx.lineTo(12, -18);
    ctx.lineTo(0, -10);
    ctx.lineTo(-12, -18);
    ctx.lineTo(-18, 2);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.type === "interceptor") {
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(18, 8);
    ctx.lineTo(10, -18);
    ctx.lineTo(0, -10);
    ctx.lineTo(-10, -18);
    ctx.lineTo(-18, 8);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.type === "turret") {
    ctx.fillRect(-20, -18, 40, 36);
    ctx.fillStyle = "#d8ffd0";
    ctx.fillRect(-8, -10, 16, 14);
  } else if (enemy.type === "bomber") {
    ctx.beginPath();
    ctx.moveTo(0, 32);
    ctx.lineTo(30, 8);
    ctx.lineTo(18, -24);
    ctx.lineTo(0, -30);
    ctx.lineTo(-18, -24);
    ctx.lineTo(-30, 8);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, 36);
    ctx.lineTo(28, 10);
    ctx.lineTo(18, -28);
    ctx.lineTo(0, -38);
    ctx.lineTo(-18, -28);
    ctx.lineTo(-28, 10);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  ctx.fillRect(-5, -enemy.height / 2 + 12, 10, 12);

  if (enemy.type !== "scout") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(-enemy.width / 2, enemy.height / 2 + 8, enemy.width, 4);
    ctx.fillStyle = "#7ef9ff";
    ctx.fillRect(-enemy.width / 2, enemy.height / 2 + 8, enemy.width * (enemy.hp / enemy.maxHp), 4);
  }

  ctx.restore();
}

function drawPowerUp(power) {
  const colors = {
    fire: "#ffc65a",
    weapon: "#7ef9ff",
    shield: "#6bd6ff",
    heal: "#3ee0a8",
  };
  const labels = {
    fire: "F",
    weapon: "W",
    shield: "S",
    heal: "H",
  };

  ctx.save();
  ctx.translate(power.x, power.y);
  ctx.fillStyle = colors[power.type];
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#03213b";
  ctx.font = "bold 12px Bahnschrift, Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(labels[power.type], 0, 1);
  ctx.restore();
}

function drawPlayerBullets() {
  for (const bullet of playerBullets) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.fillStyle = bullet.color;

    if (bullet.kind === "laser") {
      ctx.fillRect(-2, -14, 4, 28);
    } else if (bullet.kind === "missile") {
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(5, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 7);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawEnemyBullets() {
  for (const bullet of enemyBullets) {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();

    if (bullet.kind === "bomb") {
      ctx.strokeStyle = "#ffd19c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = particle.life / particle.maxLife;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.font = "bold 18px Bahnschrift, Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const item of floatingTexts) {
    ctx.globalAlpha = Math.max(0, item.life / 0.9);
    ctx.fillStyle = item.color;
    ctx.fillText(item.text, item.x, item.y);
  }
  ctx.globalAlpha = 1;
}

function drawFlash() {
  if (state.flash <= 0) {
    return;
  }

  const rgb = hexToRgb(state.flashColor);
  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(0.28, state.flash)})`;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const parsed = Number.parseInt(value, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function render() {
  drawBackground();
  drawPlayerBullets();
  drawEnemyBullets();

  for (const enemy of enemies) {
    drawEnemy(enemy);
  }

  for (const power of powerUps) {
    drawPowerUp(power);
  }

  for (const player of players) {
    drawPlayer(player);
  }

  drawParticles();
  drawFlash();
}

function loop(timestamp) {
  const delta = Math.min(0.032, (timestamp - lastTime) / 1000 || 0);
  lastTime = timestamp;

  update(delta);
  render();
  requestAnimationFrame(loop);
}

function startOrResume() {
  if (state.gameOver || !state.running) {
    resetGame();
    return;
  }

  if (state.paused) {
    pauseGame();
  }
}

ui.primaryButton.addEventListener("click", startOrResume);

window.addEventListener("keydown", (event) => {
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(
      event.code
    )
  ) {
    event.preventDefault();
  }

  if (event.code === "Space") {
    startOrResume();
    return;
  }

  if (event.code === "KeyP") {
    event.preventDefault();
    pauseGame();
    return;
  }

  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

initStars();
updateHud();
setOverlay(true, {
  kicker: "双人出击",
  title: "双机协同空战",
  text: "P1 用 WASD，P2 用方向键，同时收集武器和补给，在越来越密集的敌军里把总分推高。",
  buttonText: "开始任务",
});
requestAnimationFrame(loop);
