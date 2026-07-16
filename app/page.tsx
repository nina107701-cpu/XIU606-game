"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Ball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  level: number;
};

type LeaderboardEntry = {
  id: number;
  rank: number;
  name: string;
  score: number;
  playedAt: string;
};

type PlayerRecord = {
  rank: number;
  name: string;
  score: number;
  plays: number;
};

type SubmissionRecord = LeaderboardEntry | null;

type SkinId = "classic" | "sunny" | "starlight";

type BallSkin = {
  id: SkinId;
  name: string;
  description: string;
  ownerSrc: string;
  xiuSrc: string;
};

type LeaderboardResponse = {
  leaderboard?: LeaderboardEntry[];
  player?: PlayerRecord | null;
  submission?: SubmissionRecord;
  error?: string;
};

const WIDTH = 360;
const HEIGHT = 560;
const DROP_Y = 42;
const DANGER_Y = 92;
const RADII = [18, 23, 29, 36, 44, 53, 63, 74];
const LEVEL_POINTS = [10, 24, 52, 110, 230, 480, 980, 2000];
const LEVEL_NAMES = [
  "主人・微光",
  "脩・初雪",
  "主人・晴藍",
  "脩・紫晶",
  "主人・星願",
  "脩・守護",
  "主人・心光",
  "主人與脩",
];
const COLORS = [
  ["#d9f5ff", "#75c9ef"],
  ["#efe8ff", "#9b8be6"],
  ["#cbefff", "#439fd3"],
  ["#e5dcff", "#7b69cf"],
  ["#bde7ff", "#2c87c7"],
  ["#d8d0ff", "#6654bd"],
  ["#a8ddff", "#1975b7"],
  ["#d8f5ff", "#7362cc"],
];
const BALL_SKINS: BallSkin[] = [
  {
    id: "classic",
    name: "經典相伴",
    description: "最初的主人與脩",
    ownerSrc: "assets/owner-face.webp",
    xiuSrc: "assets/xiu-face.webp",
  },
  {
    id: "sunny",
    name: "晴空日常",
    description: "藍白帽T的輕鬆時光",
    ownerSrc: "assets/owner-sunny.webp",
    xiuSrc: "assets/xiu-sunny.webp",
  },
  {
    id: "starlight",
    name: "星夜守護",
    description: "靛藍星光的約定",
    ownerSrc: "assets/owner-starlight.webp",
    xiuSrc: "assets/xiu-starlight.webp",
  },
];

const BEST_KEY = "xiu606-merge-best-v1";
const NAME_KEY = "xiu606-player-name-v1";
const SKIN_KEY = "xiu606-ball-skin-v1";
const AIM_EDGE_GAP_IN_BALLS = 0.5;
const LEADERBOARD_API = "https://xiu606-merge-game.nina415606.chatgpt.site/api/leaderboard";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getAimBounds(radius: number) {
  const edgeGap = radius * 2 * AIM_EDGE_GAP_IN_BALLS;
  return {
    min: radius + edgeGap,
    max: WIDTH - radius - edgeGap,
  };
}

function formatPlayedAt(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "單局紀錄";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isSkinId(value: string | null): value is SkinId {
  return BALL_SKINS.some((skin) => skin.id === value);
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const imagesRef = useRef<Record<SkinId, { owner?: HTMLImageElement; xiu?: HTMLImageElement }>>({
    classic: {},
    sunny: {},
    starlight: {},
  });
  const selectedSkinRef = useRef<SkinId>("classic");
  const aimXRef = useRef(WIDTH / 2);
  const nextLevelRef = useRef(0);
  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  const soundRef = useRef(true);
  const gameOverRef = useRef(false);
  const hasStartedRef = useRef(false);
  const playerNameRef = useRef("");
  const submitScoreRef = useRef<(score: number) => void>(() => undefined);
  const canDropRef = useRef(true);
  const dangerTimeRef = useRef(0);
  const idRef = useRef(1);

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [nextLevel, setNextLevel] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("左右移動，放下第一顆心意");
  const [nameDraft, setNameDraft] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [startStep, setStartStep] = useState<"name" | "skin">("name");
  const [selectedSkin, setSelectedSkin] = useState<SkinId>("classic");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerRecord, setPlayerRecord] = useState<PlayerRecord | null>(null);
  const [lastSubmission, setLastSubmission] = useState<SubmissionRecord>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const selectedSkinConfig =
    BALL_SKINS.find((skin) => skin.id === selectedSkin) ?? BALL_SKINS[0];

  const loadLeaderboard = useCallback(async (name?: string) => {
    setLeaderboardLoading(true);
    try {
      const query = name ? `?name=${encodeURIComponent(name)}` : "";
      const response = await fetch(`${LEADERBOARD_API}${query}`, { cache: "no-store" });
      const data = (await response.json()) as LeaderboardResponse;
      if (!response.ok) throw new Error(data.error || "排行榜讀取失敗");
      setLeaderboard(data.leaderboard ?? []);
      setPlayerRecord(data.player ?? null);
      if (data.player) {
        bestRef.current = data.player.score;
        setBest(data.player.score);
      }
      setLeaderboardError("");
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : "排行榜暫時無法連線");
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const submitScore = useCallback(async (finalScore: number) => {
    const name = playerNameRef.current;
    if (!name) return;
    setSubmitStatus("saving");
    try {
      const response = await fetch(LEADERBOARD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, score: finalScore }),
      });
      const data = (await response.json()) as LeaderboardResponse;
      if (!response.ok) throw new Error(data.error || "分數保存失敗");
      setLeaderboard(data.leaderboard ?? []);
      setPlayerRecord(data.player ?? null);
      setLastSubmission(data.submission ?? null);
      if (data.player) {
        bestRef.current = data.player.score;
        setBest(data.player.score);
        window.localStorage.setItem(
          `${BEST_KEY}:${name.toLocaleLowerCase("zh-TW")}`,
          String(data.player.score),
        );
      }
      setLeaderboardError("");
      setSubmitStatus("saved");
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : "分數暫時無法保存");
      setSubmitStatus("error");
    }
  }, []);

  useEffect(() => {
    submitScoreRef.current = (finalScore) => void submitScore(finalScore);
  }, [submitScore]);

  const playTone = useCallback(
    (frequency: number, duration = 0.08, type: OscillatorType = "sine") => {
      if (!soundRef.current) return;
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        const audio = new AudioContextClass();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.055, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          audio.currentTime + duration,
        );
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + duration);
        oscillator.onended = () => void audio.close();
      } catch {
        // Sound is an enhancement; unsupported browsers keep the game playable.
      }
    },
    [],
  );

  const finishGame = useCallback((manual = false) => {
    if (!hasStartedRef.current || gameOverRef.current) return;
    gameOverRef.current = true;
    canDropRef.current = false;
    setGameOver(true);
    setMessage(manual ? "本局已結算，分數正在登記" : "心光超過界線，本局自動結算");
    playTone(165, 0.34, "sine");
    if (navigator.vibrate) navigator.vibrate([80, 45, 120]);
    submitScoreRef.current(scoreRef.current);
  }, [playTone]);

  const chooseNextLevel = useCallback(() => {
    const level = Math.random() < 0.68 ? 0 : 1;
    const bounds = getAimBounds(RADII[level]);
    nextLevelRef.current = level;
    aimXRef.current = clamp(aimXRef.current, bounds.min, bounds.max);
    setNextLevel(level);
  }, []);

  const dropBall = useCallback(() => {
    if (!hasStartedRef.current || !canDropRef.current || gameOverRef.current) return;
    const level = nextLevelRef.current;
    const radius = RADII[level];
    const bounds = getAimBounds(radius);
    const dropX = clamp(aimXRef.current, bounds.min, bounds.max);
    aimXRef.current = dropX;
    ballsRef.current.push({
      id: idRef.current++,
      x: dropX,
      y: DROP_Y,
      vx: 0,
      vy: 18,
      radius,
      level,
    });
    canDropRef.current = false;
    playTone(level === 0 ? 420 : 520, 0.07, "sine");
    if (navigator.vibrate) navigator.vibrate(12);
    setMessage("相同的臉碰在一起，就會長大");
    chooseNextLevel();
    window.setTimeout(() => {
      canDropRef.current = true;
    }, 430);
  }, [chooseNextLevel, playTone]);

  const resetGame = useCallback(() => {
    ballsRef.current = [];
    scoreRef.current = 0;
    dangerTimeRef.current = 0;
    gameOverRef.current = false;
    canDropRef.current = true;
    aimXRef.current = WIDTH / 2;
    setScore(0);
    setGameOver(false);
    setSubmitStatus("idle");
    setLastSubmission(null);
    setMessage("新的一局，這次一定會合得更高");
    chooseNextLevel();
    playTone(360, 0.08, "triangle");
  }, [chooseNextLevel, playTone]);

  const goToSkinSelection = useCallback(() => {
    const cleaned = nameDraft.normalize("NFKC").trim().replace(/\s+/g, " ");
    const valid =
      Array.from(cleaned).length >= 1 &&
      Array.from(cleaned).length <= 12 &&
      /^[\p{L}\p{N}_.\- ]+$/u.test(cleaned);
    if (!valid) {
      setLeaderboardError("暱稱請輸入 1–12 個中英文字、數字、空格或 _.-");
      return;
    }
    setLeaderboardError("");
    setStartStep("skin");
  }, [nameDraft]);

  const startGame = useCallback(() => {
    const cleaned = nameDraft.normalize("NFKC").trim().replace(/\s+/g, " ");
    const valid =
      Array.from(cleaned).length >= 1 &&
      Array.from(cleaned).length <= 12 &&
      /^[\p{L}\p{N}_.\- ]+$/u.test(cleaned);
    if (!valid) {
      setLeaderboardError("暱稱請輸入 1–12 個中英文字、數字、空格或 _.-");
      return;
    }
    playerNameRef.current = cleaned;
    hasStartedRef.current = true;
    setPlayerName(cleaned);
    setHasStarted(true);
    setStartStep("name");
    setLeaderboardError("");
    window.localStorage.setItem(NAME_KEY, cleaned);
    window.localStorage.setItem(SKIN_KEY, selectedSkinRef.current);
    const localBest = Number(
      window.localStorage.getItem(`${BEST_KEY}:${cleaned.toLocaleLowerCase("zh-TW")}`) || 0,
    );
    bestRef.current = localBest;
    setBest(localBest);
    void loadLeaderboard(cleaned);
    resetGame();
  }, [loadLeaderboard, nameDraft, resetGame]);

  const changePlayer = useCallback(() => {
    ballsRef.current = [];
    scoreRef.current = 0;
    gameOverRef.current = false;
    hasStartedRef.current = false;
    setScore(0);
    setGameOver(false);
    setHasStarted(false);
    setLeaderboardOpen(false);
    setNameDraft(playerNameRef.current);
    setStartStep("name");
    setSubmitStatus("idle");
    setLastSubmission(null);
  }, []);

  const moveAim = useCallback((amount: number) => {
    const radius = RADII[nextLevelRef.current];
    const bounds = getAimBounds(radius);
    aimXRef.current = clamp(
      aimXRef.current + amount,
      bounds.min,
      bounds.max,
    );
  }, []);

  useEffect(() => {
    const storedName = window.localStorage.getItem(NAME_KEY) || "";
    const storedSkinValue = window.localStorage.getItem(SKIN_KEY);
    const storedSkin: SkinId = isSkinId(storedSkinValue) ? storedSkinValue : "classic";
    const storedBest = storedName
      ? Number(
          window.localStorage.getItem(
            `${BEST_KEY}:${storedName.toLocaleLowerCase("zh-TW")}`,
          ) || 0,
        )
      : 0;
    bestRef.current = storedBest;
    selectedSkinRef.current = storedSkin;
    const hydrationFrame = window.requestAnimationFrame(() => {
      setBest(storedBest);
      setNameDraft(storedName);
      setSelectedSkin(storedSkin);
      void loadLeaderboard();
    });

    for (const skin of BALL_SKINS) {
      const owner = new Image();
      owner.src = skin.ownerSrc;
      owner.onload = () => {
        imagesRef.current[skin.id].owner = owner;
      };
      const xiu = new Image();
      xiu.src = skin.xiuSrc;
      xiu.onload = () => {
        imagesRef.current[skin.id].xiu = xiu;
      };
    }
    return () => window.cancelAnimationFrame(hydrationFrame);
  }, [loadLeaderboard]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowLeft") moveAim(-18);
      if (event.key === "ArrowRight") moveAim(18);
      if (event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        dropBall();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dropBall, moveAim]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    let animationFrame = 0;
    let lastTime = performance.now();

    const drawBall = (ball: Ball, alpha = 1) => {
      const [light, deep] = COLORS[ball.level];
      context.save();
      context.globalAlpha = alpha;
      context.translate(ball.x, ball.y);

      context.beginPath();
      context.arc(0, 0, ball.radius, 0, Math.PI * 2);
      const gradient = context.createRadialGradient(
        -ball.radius * 0.3,
        -ball.radius * 0.35,
        ball.radius * 0.08,
        0,
        0,
        ball.radius,
      );
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.38, light);
      gradient.addColorStop(1, deep);
      context.fillStyle = gradient;
      context.fill();
      context.lineWidth = Math.max(2, ball.radius * 0.065);
      context.strokeStyle = "rgba(255,255,255,.92)";
      context.stroke();

      context.save();
      context.beginPath();
      context.arc(0, 0, ball.radius - 2, 0, Math.PI * 2);
      context.clip();
      const activeImages = imagesRef.current[selectedSkinRef.current];
      const image = ball.level % 2 === 0 ? activeImages.owner : activeImages.xiu;
      if (image) {
        const size = ball.radius * 2.1;
        context.drawImage(image, -size / 2, -size * 0.5, size, size);
      } else {
        context.fillStyle = "#284e78";
        context.font = `700 ${ball.radius}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(ball.level % 2 === 0 ? "主" : "脩", 0, 2);
      }
      context.restore();

      context.beginPath();
      context.arc(
        -ball.radius * 0.34,
        -ball.radius * 0.38,
        ball.radius * 0.16,
        0,
        Math.PI * 2,
      );
      context.fillStyle = "rgba(255,255,255,.42)";
      context.fill();
      context.restore();
    };

    const mergePair = (firstIndex: number, secondIndex: number) => {
      const balls = ballsRef.current;
      const first = balls[firstIndex];
      const second = balls[secondIndex];
      const newLevel = first.level + 1;
      const x = (first.x + second.x) / 2;
      const y = (first.y + second.y) / 2;
      balls.splice(secondIndex, 1);
      balls.splice(firstIndex, 1);
      balls.push({
        id: idRef.current++,
        x,
        y,
        vx: (first.vx + second.vx) * 0.22,
        vy: -95,
        radius: RADII[newLevel],
        level: newLevel,
      });
      const nextScore = scoreRef.current + LEVEL_POINTS[newLevel];
      scoreRef.current = nextScore;
      setScore(nextScore);
      if (nextScore > bestRef.current) {
        bestRef.current = nextScore;
        setBest(nextScore);
        const activeName = playerNameRef.current.toLocaleLowerCase("zh-TW");
        window.localStorage.setItem(`${BEST_KEY}:${activeName}`, String(nextScore));
      }
      setMessage(`${LEVEL_NAMES[newLevel]} 合成成功 ＋${LEVEL_POINTS[newLevel]}`);
      playTone(560 + newLevel * 68, 0.11, "triangle");
      if (navigator.vibrate) navigator.vibrate(18 + newLevel * 3);
    };

    const updatePhysics = (delta: number) => {
      const balls = ballsRef.current;
      const gravity = 930;

      for (const ball of balls) {
        ball.vy += gravity * delta;
        ball.vx *= Math.pow(0.992, delta * 60);
        ball.x += ball.vx * delta;
        ball.y += ball.vy * delta;

        if (ball.x - ball.radius < 4) {
          ball.x = ball.radius + 4;
          ball.vx = Math.abs(ball.vx) * 0.45;
        }
        if (ball.x + ball.radius > WIDTH - 4) {
          ball.x = WIDTH - ball.radius - 4;
          ball.vx = -Math.abs(ball.vx) * 0.45;
        }
        if (ball.y + ball.radius > HEIGHT - 6) {
          ball.y = HEIGHT - ball.radius - 6;
          ball.vy = -Math.abs(ball.vy) * 0.2;
          ball.vx *= 0.94;
          if (Math.abs(ball.vy) < 8) ball.vy = 0;
        }
      }

      for (let i = 0; i < balls.length; i += 1) {
        for (let j = i + 1; j < balls.length; j += 1) {
          const a = balls[i];
          const b = balls[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 0.001;
          const minDistance = a.radius + b.radius;
          if (distance >= minDistance) continue;

          if (a.level === b.level && a.level < RADII.length - 1) {
            mergePair(i, j);
            return;
          }

          const nx = dx / distance;
          const ny = dy / distance;
          const overlap = minDistance - distance;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const relativeVelocityX = b.vx - a.vx;
          const relativeVelocityY = b.vy - a.vy;
          const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;
          if (velocityAlongNormal < 0) {
            const impulse = -(1.22 * velocityAlongNormal) / 2;
            a.vx -= impulse * nx;
            a.vy -= impulse * ny;
            b.vx += impulse * nx;
            b.vy += impulse * ny;
          }
        }
      }

      const danger = balls.some(
        (ball) =>
          ball.y > DANGER_Y &&
          ball.y - ball.radius < DANGER_Y &&
          ball.y > DROP_Y + 24,
      );
      dangerTimeRef.current = danger
        ? dangerTimeRef.current + delta
        : Math.max(0, dangerTimeRef.current - delta * 1.6);
      if (dangerTimeRef.current > 1.2) finishGame(false);
    };

    const render = (now: number) => {
      const delta = Math.min((now - lastTime) / 1000, 0.025);
      lastTime = now;
      if (hasStartedRef.current && !gameOverRef.current) updatePhysics(delta);

      context.clearRect(0, 0, WIDTH, HEIGHT);

      const background = context.createLinearGradient(0, 0, 0, HEIGHT);
      background.addColorStop(0, "#eefaff");
      background.addColorStop(0.48, "#d7f1ff");
      background.addColorStop(1, "#b9ddf5");
      context.fillStyle = background;
      context.fillRect(0, 0, WIDTH, HEIGHT);

      context.fillStyle = "rgba(255,255,255,.23)";
      for (let index = 0; index < 14; index += 1) {
        const x = ((index * 83 + 31) % WIDTH) + Math.sin(now / 1200 + index) * 5;
        const y = (index * 47 + 22) % HEIGHT;
        const radius = 2 + (index % 4);
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      context.save();
      context.setLineDash([7, 7]);
      context.strokeStyle =
        dangerTimeRef.current > 0.4 ? "rgba(226,91,119,.8)" : "rgba(75,139,185,.34)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(12, DANGER_Y);
      context.lineTo(WIDTH - 12, DANGER_Y);
      context.stroke();
      context.restore();

      context.strokeStyle = "rgba(44,119,166,.24)";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(aimXRef.current, 0);
      context.lineTo(aimXRef.current, DROP_Y + RADII[nextLevelRef.current] + 12);
      context.stroke();

      drawBall({
        id: -1,
        x: aimXRef.current,
        y: DROP_Y,
        vx: 0,
        vy: 0,
        radius: RADII[nextLevelRef.current],
        level: nextLevelRef.current,
      }, 0.94);

      for (const ball of ballsRef.current) drawBall(ball);

      context.fillStyle = "rgba(32,91,131,.28)";
      context.fillRect(0, HEIGHT - 7, WIDTH, 7);
      animationFrame = window.requestAnimationFrame(render);
    };

    animationFrame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [finishGame, playTone]);

  return (
    <main className="page-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="game-phone" aria-label="脩與主人的合成小遊戲">
        <header className="game-header">
          <div>
            <p className="eyebrow">XIU 606 · MINI GAME</p>
            <h1>合成心光</h1>
            <p className="subtitle">把主人與脩，一顆一顆接住</p>
          </div>
          <div className="header-actions">
            <button
              className="rank-button"
              type="button"
              aria-label="開啟排行榜"
              onClick={() => {
                setLeaderboardOpen(true);
                void loadLeaderboard(playerNameRef.current || undefined);
              }}
            >
              <span aria-hidden="true">#</span>
              <small>排行</small>
            </button>
            <button
              className={`sound-button ${soundOn ? "active" : ""}`}
              type="button"
              aria-label={soundOn ? "關閉音效" : "開啟音效"}
              onClick={() => {
                const next = !soundRef.current;
                soundRef.current = next;
                setSoundOn(next);
                if (next) playTone(520, 0.09, "sine");
              }}
            >
              <span aria-hidden="true">♪</span>
              <small>{soundOn ? "ON" : "OFF"}</small>
            </button>
          </div>
        </header>

        {hasStarted && (
          <div className="top-player-bar">
            <div className="active-player">
              <span>玩家・{selectedSkinConfig.name}</span>
              <strong>{playerName}</strong>
            </div>
            <div className="top-player-actions">
              <button type="button" onClick={changePlayer}>更換玩家</button>
              {!gameOver && (
                <button className="end-game-button" type="button" onClick={() => finishGame(true)}>
                  結束遊戲
                </button>
              )}
            </div>
          </div>
        )}

        <div className="score-row">
          <div className="score-card primary-score">
            <span>本局心光</span>
            <strong>{score.toLocaleString("zh-TW")}</strong>
          </div>
          <div className="score-card">
            <span>{playerName ? `${playerName}最佳` : "個人最佳"}</span>
            <strong>{best.toLocaleString("zh-TW")}</strong>
          </div>
          <div className="next-card">
            <span>下一顆</span>
            <div className={`next-face level-${nextLevel}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={nextLevel % 2 === 0 ? selectedSkinConfig.ownerSrc : selectedSkinConfig.xiuSrc}
                alt={nextLevel % 2 === 0 ? "主人" : "脩"}
              />
            </div>
          </div>
        </div>

        <div className="canvas-frame">
          <canvas ref={canvasRef} aria-label="落下合成遊戲區" />
          <div className="danger-label">心光線</div>
          {gameOver && (
            <div className="game-over-card" role="dialog" aria-modal="true">
              <p>本局完成</p>
              <h2>{score.toLocaleString("zh-TW")} 心光</h2>
              <span>
                {submitStatus === "saving" && "正在登記排行榜…"}
                {submitStatus === "saved" && lastSubmission && playerRecord && `本局第 ${lastSubmission.rank} 名・個人最佳 ${playerRecord.score.toLocaleString("zh-TW")}`}
                {submitStatus === "error" && "分數暫存於手機，稍後可以再挑戰"}
                {submitStatus === "idle" && "小窩裝滿主人與脩了"}
              </span>
              <button
                className="secondary-result-button"
                type="button"
                onClick={() => setLeaderboardOpen(true)}
              >
                查看排行榜
              </button>
              <button type="button" onClick={resetGame}>
                再玩一次
              </button>
            </div>
          )}
        </div>

        <p className="game-message" aria-live="polite">{message}</p>

        <div className="control-row" aria-label="遊戲操作">
          <button type="button" onClick={() => moveAim(-24)} aria-label="往左移動">
            <span aria-hidden="true">←</span>
          </button>
          <button className="drop-button" type="button" onClick={dropBall}>
            <span aria-hidden="true">↓</span>
            放下
          </button>
          <button type="button" onClick={() => moveAim(24)} aria-label="往右移動">
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <footer className="game-footer">
          <span>遊戲區已鎖定・請使用上方功能鍵與下方操作鍵</span>
        </footer>

        {!hasStarted && (
          <div className="player-start-overlay">
            <div className="player-start-card" role="dialog" aria-modal="true" aria-labelledby="player-title">
              {startStep === "name" ? (
                <>
                  <p className="start-kicker">WELCOME TO XIU 606</p>
                  <h2 id="player-title">留下妳的玩家名字</h2>
                  <p>下一步可以挑選這局想用的主人與脩</p>
                  <label htmlFor="player-name">玩家暱稱</label>
                  <input
                    id="player-name"
                    value={nameDraft}
                    maxLength={12}
                    autoComplete="nickname"
                    placeholder="例如：星星、Nina、木木"
                    onChange={(event) => {
                      setNameDraft(event.target.value);
                      setLeaderboardError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") goToSkinSelection();
                    }}
                  />
                  <div className="name-counter">{Array.from(nameDraft).length}/12</div>
                  {leaderboardError && <p className="form-error">{leaderboardError}</p>}
                  <button className="start-button" type="button" onClick={goToSkinSelection}>下一步・選擇球面</button>
                  <div className="start-ranking">
                    <div className="start-ranking-title">
                      <span>目前前三名</span>
                      <button type="button" onClick={() => setLeaderboardOpen(true)}>完整排行</button>
                    </div>
                    {leaderboardLoading ? (
                      <p className="ranking-empty">讀取排行中…</p>
                    ) : leaderboard.length ? (
                      <ol>
                        {leaderboard.slice(0, 3).map((entry) => (
                          <li key={entry.id}>
                            <b>{entry.rank}</b>
                            <span>{entry.name}</span>
                            <strong>{entry.score.toLocaleString("zh-TW")}</strong>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="ranking-empty">第一個名字，等妳來留下</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button className="skin-back-button" type="button" onClick={() => setStartStep("name")}>← 返回玩家名字</button>
                  <p className="start-kicker">CHOOSE YOUR HEARTLIGHT</p>
                  <h2 id="player-title">挑一組陪妳合成</h2>
                  <p>{nameDraft.trim()}，這一局想接住哪一組主人與脩？</p>
                  <div className="skin-grid" role="radiogroup" aria-label="選擇球面套裝">
                    {BALL_SKINS.map((skin) => (
                      <button
                        className={`skin-option ${selectedSkin === skin.id ? "selected" : ""}`}
                        type="button"
                        role="radio"
                        aria-checked={selectedSkin === skin.id}
                        key={skin.id}
                        onClick={() => {
                          selectedSkinRef.current = skin.id;
                          setSelectedSkin(skin.id);
                          window.localStorage.setItem(SKIN_KEY, skin.id);
                        }}
                      >
                        <span className="skin-pair" aria-hidden="true">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={skin.ownerSrc} alt="" />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={skin.xiuSrc} alt="" />
                        </span>
                        <strong>{skin.name}</strong>
                        <small>{skin.description}</small>
                        <span className="skin-check">{selectedSkin === skin.id ? "✓ 已選擇" : "點我選擇"}</span>
                      </button>
                    ))}
                  </div>
                  <button className="start-button" type="button" onClick={startGame}>使用「{selectedSkinConfig.name}」開始</button>
                </>
              )}
            </div>
          </div>
        )}

        {leaderboardOpen && (
          <div className="ranking-overlay">
            <div className="ranking-card" role="dialog" aria-modal="true" aria-labelledby="ranking-title">
              <div className="ranking-header">
                <div>
                  <p>HEARTLIGHT RANKING</p>
                  <h2 id="ranking-title">心光排行榜</h2>
                </div>
                <button type="button" aria-label="關閉排行榜" onClick={() => setLeaderboardOpen(false)}>×</button>
              </div>
              {playerRecord && (
                <div className="my-ranking">
                  <span>個人最佳排名</span>
                  <strong>第 {playerRecord.rank} 名</strong>
                  <b>{playerRecord.score.toLocaleString("zh-TW")}・共 {playerRecord.plays} 局</b>
                </div>
              )}
              {leaderboardLoading ? (
                <p className="ranking-empty large">排行榜讀取中…</p>
              ) : leaderboardError && !leaderboard.length ? (
                <p className="ranking-empty large">{leaderboardError}</p>
              ) : leaderboard.length ? (
                <ol className="ranking-list">
                  {leaderboard.map((entry) => (
                    <li className={entry.name === playerName ? "mine" : ""} key={entry.id}>
                      <b>{entry.rank}</b>
                      <div>
                        <span>{entry.name}</span>
                        <small>{formatPlayedAt(entry.playedAt)}</small>
                      </div>
                      <strong>{entry.score.toLocaleString("zh-TW")}</strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="ranking-empty large">排行榜還是空的，第一名在等妳</p>
              )}
              <button className="ranking-close-button" type="button" onClick={() => setLeaderboardOpen(false)}>回到遊戲</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
