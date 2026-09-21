const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  player: "Игрок",
  difficulty: "Средний",
  score: 0,
  time: 45,
  running: false,
  timer: null,
  spawn: null,
  bubble: null
};

const difficultyConfig = {
  "Легко": {time: 60, min: 72, max: 105, interval: 1000, colors: ["pink","blue","purple"]},
  "Средний": {time: 45, min: 56, max: 85, interval: 720, colors: ["pink","blue","purple","cyan"]},
  "Сложно": {time: 30, min: 42, max: 68, interval: 460, colors: ["pink","blue","purple","cyan","gold"]}
};

function show(screen) {
  $$(".screen").forEach(x => x.classList.remove("active"));
  $("#" + screen).classList.add("active");
  if (screen === "leaderboard") loadLeaders();
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

async function checkHealth() {
  try {
    const r = await fetch("/api/health");
    const data = await r.json();
    const el = $("#dbStatus");
    if (data.status === "ok") {
      el.classList.add("ok");
      el.innerHTML = "<i></i> PostgreSQL подключён";
    } else {
      el.innerHTML = "<i></i> PostgreSQL недоступен";
    }
  } catch {
    $("#dbStatus").innerHTML = "<i></i> сервер недоступен";
  }
}

async function loadBest() {
  try {
    const r = await fetch("/api/scores");
    if (!r.ok) return;
    const rows = await r.json();
    $("#homeBest").textContent = rows.length ? rows[0].score : "—";
  } catch {}
}

function setup() {
  $("#playerName").value = state.player;
  $$(".difficulty").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.difficulty === state.difficulty);
  });
}

function startGame() {
  state.player = $("#playerName").value.trim() || "Игрок";
  state.difficulty = $(".difficulty.selected").dataset.difficulty;
  state.score = 0;
  state.time = difficultyConfig[state.difficulty].time;
  state.running = true;

  $("#gameName").textContent = state.player;
  $("#score").textContent = "0";
  $("#timer").textContent = `00:${String(state.time).padStart(2,"0")}`;
  $("#fieldHint").style.display = "none";
  show("game");

  spawnBubble();
  state.timer = setInterval(() => {
    state.time--;
    $("#timer").textContent = `00:${String(state.time).padStart(2,"0")}`;
    if (state.time <= 0) finishGame();
  }, 1000);
}

function clearBubble() {
  if (state.bubble) {
    state.bubble.remove();
    state.bubble = null;
  }
}

function spawnBubble() {
  if (!state.running) return;
  clearBubble();

  const field = $("#playfield");
  const cfg = difficultyConfig[state.difficulty];
  const size = Math.floor(cfg.min + Math.random() * (cfg.max - cfg.min));
  const colors = {
    pink: ["#ef70bf","#9c3c82"],
    blue: ["#72ebf5","#3478aa"],
    purple: ["#a68bff","#4f3c9a"],
    cyan: ["#8bf8ff","#328b99"],
    gold: ["#ffe48a","#ad7434"]
  };
  const key = cfg.colors[Math.floor(Math.random()*cfg.colors.length)];
  const [a,b] = colors[key];

  const bubble = document.createElement("div");
  bubble.className = "game-bubble";
  bubble.style.width = size+"px";
  bubble.style.height = size+"px";
  bubble.style.background = `radial-gradient(circle at 35% 30%, #ffffff66, ${a} 34%, ${b})`;

  const maxX = Math.max(10, field.clientWidth - size - 10);
  const maxY = Math.max(10, field.clientHeight - size - 10);
  bubble.style.left = Math.floor(10 + Math.random()*maxX) + "px";
  bubble.style.top = Math.floor(10 + Math.random()*maxY) + "px";

  bubble.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!state.running) return;
    const rect = bubble.getBoundingClientRect();
    popParticles(rect.left + size/2, rect.top + size/2, a);
    state.score += 10;
    $("#score").textContent = state.score;
    bubble.remove();
    state.bubble = null;
    spawnBubble();
  });

  field.appendChild(bubble);
  state.bubble = bubble;
}

function popParticles(x,y,color) {
  for (let i=0;i<12;i++) {
    const p = document.createElement("span");
    p.className = "pop-particle";
    p.style.left = x+"px";
    p.style.top = y+"px";
    p.style.background = i%3===0 ? "#fff" : color;
    const angle = Math.random()*Math.PI*2;
    const dist = 30 + Math.random()*65;
    p.style.setProperty("--dx", `${Math.cos(angle)*dist}px`);
    p.style.setProperty("--dy", `${Math.sin(angle)*dist}px`);
    document.body.appendChild(p);
    setTimeout(()=>p.remove(),600);
  }
}

async function finishGame() {
  if (!state.running) return;
  state.running = false;
  clearInterval(state.timer);
  state.timer = null;
  clearBubble();

  $("#resultScore").textContent = state.score;
  $("#resultPlayer").textContent = `${state.player} · ${state.difficulty}`;
  $("#saveNote").textContent = "Сохранение результата…";
  show("result");

  try {
    const r = await fetch("/api/scores", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        player_name:state.player,
        score:state.score,
        difficulty:state.difficulty
      })
    });
    $("#saveNote").textContent = r.ok ? "✓ Результат сохранён" : "⚠ Не удалось сохранить результат";
  } catch {
    $("#saveNote").textContent = "⚠ Сервер недоступен";
  }
}

async function loadLeaders() {
  const box = $("#leaderRows");
  box.innerHTML = '<div class="leader-row"><span></span><span class="player">Загрузка…</span><span></span><span></span><span></span></div>';
  try {
    const r = await fetch("/api/scores");
    if (!r.ok) throw new Error();
    const rows = await r.json();
    if (!rows.length) {
      box.innerHTML = '<div class="leader-row"><span>—</span><span class="player">Пока нет результатов</span><span>—</span><span>Стань первой!</span><span>—</span></div>';
      return;
    }
    box.innerHTML = rows.map((row,i) => `
      <div class="leader-row">
        <span class="rank">${i+1}</span>
        <span class="player">${escapeHtml(row.player_name)}</span>
        <span class="points">${row.score}</span>
        <span><span class="badge">${escapeHtml(row.difficulty)}</span></span>
        <span>${escapeHtml(row.created_at)}</span>
      </div>
    `).join("");
  } catch {
    box.innerHTML = '<div class="leader-row"><span>!</span><span class="player">Не удалось загрузить результаты</span><span></span><span>Проверь PostgreSQL</span><span></span></div>';
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

$("#startBtn").onclick = () => { setup(); show("setup"); };
$("#leadersBtn").onclick = () => show("leaderboard");
$("#leadersTop").onclick = () => show("leaderboard");
$("#playBtn").onclick = startGame;
$("#againBtn").onclick = () => { setup(); show("setup"); };
$("#resultLeadersBtn").onclick = () => show("leaderboard");

$$("[data-screen]").forEach(btn => btn.addEventListener("click", e => {
  e.preventDefault();
  show(btn.dataset.screen);
}));

$$(".difficulty").forEach(btn => btn.addEventListener("click", () => {
  state.difficulty = btn.dataset.difficulty;
  $$(".difficulty").forEach(x => x.classList.remove("selected"));
  btn.classList.add("selected");
}));

window.addEventListener("resize", () => {
  if (state.running && state.bubble) {
    const field = $("#playfield");
    const rect = state.bubble.getBoundingClientRect();
    const f = field.getBoundingClientRect();
    if (rect.right > f.right || rect.bottom > f.bottom) spawnBubble();
  }
});

checkHealth();
loadBest();
