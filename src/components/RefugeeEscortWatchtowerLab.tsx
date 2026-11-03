import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Shield,
  Heart,
  Dog,
  TowerControl,
  Sparkles,
  Users,
  Compass,
  AlertTriangle,
  Play,
  RotateCcw,
  Volume2,
  Sword,
  Flame,
  ArrowRight,
  Sun,
  Moon,
} from "lucide-react";

type LabTab = "simulator" | "statemachine" | "progression";

interface Entity2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
}

interface RefugeeEntity extends Entity2D {
  hp: number;
  maxHp: number;
  mode: "Lost" | "Following" | "Home";
  spoken: string;
  speechTimer: number;
  flash: number;
  shiver: number;
  townIndex: number;
}

interface EnemyEntity extends Entity2D {
  id: number;
  kind: "Wolf" | "Rat" | "Shade";
  hp: number;
  speed: number;
  damage: number;
}

interface ArrowEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface ParticleEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

const REGIONAL_LINES: string[][] = [
  [
    "They took the mill first. Then the well.",
    "Keep the fire high tonight, please.",
    "I heard wolves inside the walls last night.",
    "My boy went for wood. He'll be back soon.",
  ],
  [
    "The lanterns sing in the marsh. Don't listen.",
    "Salt keeps the drowned out. Mostly.",
    "The abbey bells still ring, under the water.",
    "Spores in the bread again.",
  ],
  [
    "The cold is coming from the barrows, not the sky.",
    "Warden Kell hasn't slept in days.",
    "Something old hunts by the standing stones.",
    "Keep your hands near the fire.",
  ],
  [
    "The caravan is our only water.",
    "The sky splits over the steppe every night.",
    "Glass sings in the wind out there.",
    "Hyenas laugh just like people.",
  ],
];

export const RefugeeEscortWatchtowerLab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LabTab>("simulator");
  const [isNight, setIsNight] = useState<boolean>(false);
  const [autoHero, setAutoHero] = useState<boolean>(true);
  const [towerFortified, setTowerFortified] = useState<boolean>(true);
  const [rescuedCount, setRescuedCount] = useState<number>(1);
  const [materials, setMaterials] = useState<number>(3);
  const [announcement, setAnnouncement] = useState<string>(
    "ESCORT THE LOST REFUGEE TO THE TOWN HEARTH"
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<{
    player: Entity2D & { speed: number };
    refugee: RefugeeEntity | null;
    hound: (Entity2D & { hp: number; targetId: number | null }) | null;
    watchtower: { x: number; y: number; reload: number; shots: number };
    enemies: EnemyEntity[];
    arrows: ArrowEntity[];
    particles: ParticleEntity[];
    targetX: number;
    targetY: number;
    townX: number;
    townY: number;
    townRadius: number;
    nextEnemyId: number;
    enemySpawnTimer: number;
    time: number;
  }>({
    player: { x: 260, y: 220, vx: 0, vy: 0, facing: 1, speed: 65 },
    refugee: {
      x: 470,
      y: 90,
      vx: 0,
      vy: 0,
      facing: -1,
      hp: 40,
      maxHp: 40,
      mode: "Lost",
      spoken: "Please! I can't find the way back!",
      speechTimer: 4.0,
      flash: 0,
      shiver: 0,
      townIndex: 0,
    },
    hound: null,
    watchtower: { x: 200, y: 150, reload: 0, shots: 0 },
    enemies: [],
    arrows: [],
    particles: [],
    targetX: 260,
    targetY: 220,
    townX: 160,
    townY: 210,
    townRadius: 105,
    nextEnemyId: 1,
    enemySpawnTimer: 2.0,
    time: 0,
  });

  // Keep hound companion in sync with rescued count milestone (3 rescues unlocks Hound)
  useEffect(() => {
    if (rescuedCount >= 3 && !stateRef.current.hound) {
      stateRef.current.hound = {
        x: stateRef.current.player.x - 15,
        y: stateRef.current.player.y + 15,
        vx: 0,
        vy: 0,
        facing: 1,
        hp: 30,
        targetId: null,
      };
    } else if (rescuedCount < 3) {
      stateRef.current.hound = null;
    }
  }, [rescuedCount]);

  const spawnRefugee = useCallback(() => {
    const angle = Math.random() * Math.PI * 1.5 - 0.2;
    const dist = 280 + Math.random() * 80;
    const tx = stateRef.current.townX + Math.cos(angle) * dist;
    const ty = stateRef.current.townY + Math.sin(angle) * dist;
    stateRef.current.refugee = {
      x: Math.min(540, Math.max(340, tx)),
      y: Math.min(320, Math.max(60, ty)),
      vx: 0,
      vy: 0,
      facing: -1,
      hp: 40,
      maxHp: 40,
      mode: "Lost",
      spoken: "Please! I can't find the way back!",
      speechTimer: 4.5,
      flash: 0,
      shiver: 0,
      townIndex: Math.floor(Math.random() * 4),
    };
    setAnnouncement("A LOST REFUGEE SHOUTS FOR HELP OUTSIDE TOWN!");
  }, []);

  const spawnEnemy = useCallback((kind?: "Wolf" | "Rat" | "Shade") => {
    const s = stateRef.current;
    const enemyKind = kind || (Math.random() > 0.4 ? "Wolf" : "Shade");
    const angle = Math.random() * Math.PI * 2;
    const dist = 320;
    const ex = s.townX + Math.cos(angle) * dist;
    const ey = s.townY + Math.sin(angle) * dist;
    s.enemies.push({
      id: s.nextEnemyId++,
      kind: enemyKind,
      x: Math.min(560, Math.max(40, ex)),
      y: Math.min(350, Math.max(30, ey)),
      vx: 0,
      vy: 0,
      facing: 1,
      hp: enemyKind === "Wolf" ? 28 : enemyKind === "Shade" ? 18 : 12,
      speed: enemyKind === "Wolf" ? 42 : enemyKind === "Shade" ? 50 : 35,
      damage: enemyKind === "Wolf" ? 14 : enemyKind === "Shade" ? 20 : 8,
    });
  }, []);

  const resetSimulation = useCallback(() => {
    const s = stateRef.current;
    s.player.x = 260;
    s.player.y = 220;
    s.targetX = 260;
    s.targetY = 220;
    s.enemies = [];
    s.arrows = [];
    s.particles = [];
    s.watchtower.shots = 0;
    spawnRefugee();
  }, [spawnRefugee]);

  // Handle canvas click to navigate Hero
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    stateRef.current.targetX = clickX;
    stateRef.current.targetY = clickY;
    setAutoHero(false);
  };

  // Main 60 Hz Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const renderLoop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const s = stateRef.current;
      s.time += dt;

      // 1. Spawner Logic (Wild Enemies)
      s.enemySpawnTimer -= dt;
      if (s.enemySpawnTimer <= 0) {
        s.enemySpawnTimer = isNight ? 2.2 : 4.5;
        if (s.enemies.length < (isNight ? 7 : 4)) {
          spawnEnemy();
        }
      }

      // 2. Auto-Pilot Hero AI (if enabled)
      if (autoHero) {
        if (s.refugee && s.refugee.mode === "Lost") {
          // Guide toward lost refugee
          s.targetX = s.refugee.x + 16;
          s.targetY = s.refugee.y;
        } else if (s.refugee && s.refugee.mode === "Following") {
          // Guide back toward town hearth
          s.targetX = s.townX + 20;
          s.targetY = s.townY + 10;
        } else {
          // Patrol near watchtower perimeter
          const patrolAngle = s.time * 0.5;
          s.targetX = s.townX + Math.cos(patrolAngle) * 70;
          s.targetY = s.townY + Math.sin(patrolAngle) * 45;
        }
      }

      // 3. Player Kinematics
      const p = s.player;
      const pdx = s.targetX - p.x;
      const pdy = s.targetY - p.y;
      const pdist = Math.hypot(pdx, pdy);
      if (pdist > 3) {
        p.vx = (pdx / pdist) * p.speed;
        p.vy = (pdy / pdist) * p.speed;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.facing = p.vx < 0 ? -1 : 1;
      } else {
        p.vx = 0;
        p.vy = 0;
      }

      // 4. Refugee Kinematics & State Machine (Matches Townsfolk.cpp)
      const r = s.refugee;
      if (r) {
        r.speechTimer -= dt;
        r.flash = Math.max(0, r.flash - dt);
        r.shiver = isNight ? Math.sin(s.time * 25) * 1.5 : 0;

        const CALL_RANGE = 38; // Townsfolk::CALL = 28 (scaled for lab canvas)
        const LEASH_RANGE = 180; // Townsfolk::LEASH = 260
        const TRAIL_SPEED = 48; // Townsfolk::TRAIL = 50

        const distToPlayer = Math.hypot(p.x - r.x, p.y - r.y);
        const distToTown = Math.hypot(s.townX - r.x, s.townY - r.y);

        if (r.mode === "Lost") {
          // Check if player approached close enough to rescue
          if (distToPlayer < CALL_RANGE) {
            r.mode = "Following";
            r.spoken = "Stay close, I'm right behind you.";
            r.speechTimer = 3.5;
            setAnnouncement(
              "A REFUGEE FOLLOWS YOU - BRING THEM SAFELY TO TOWN!"
            );
            // Spark particles
            for (let i = 0; i < 8; i++) {
              s.particles.push({
                x: r.x,
                y: r.y - 10,
                vx: (Math.random() - 0.5) * 60,
                vy: -Math.random() * 50 - 15,
                color: "#fde047",
                life: 0.6,
                maxLife: 0.6,
                size: 2.5,
              });
            }
          }
        } else if (r.mode === "Following") {
          // Check leash break
          if (distToPlayer > LEASH_RANGE) {
            r.mode = "Lost";
            r.spoken = "Wait! Don't leave me behind!";
            r.speechTimer = 4.0;
            setAnnouncement(
              "LEASH BROKEN! YOU SPRINTED TOO FAR AHEAD OF THE REFUGEE!"
            );
          } else {
            // Trail hero breadcrumb
            r.facing = p.x < r.x ? -1 : 1;
            if (distToPlayer > 26) {
              const rx = p.x - r.x;
              const ry = p.y - r.y;
              const rd = Math.hypot(rx, ry);
              r.x += (rx / rd) * TRAIL_SPEED * dt;
              r.y += (ry / rd) * TRAIL_SPEED * dt;
            }

            // Check arrival at town safe radius
            if (distToTown < s.townRadius - 15) {
              r.mode = "Home";
              r.spoken = REGIONAL_LINES[r.townIndex][0];
              r.speechTimer = 5.0;
              setRescuedCount((c) => c + 1);
              setMaterials((m) => m + 3);
              setAnnouncement(
                "REFUGEE RESCUED! +3 MATERIALS & +5% VENDOR DISCOUNT!"
              );

              // Celebration fireworks
              for (let i = 0; i < 24; i++) {
                s.particles.push({
                  x: r.x,
                  y: r.y - 12,
                  vx: (Math.random() - 0.5) * 120,
                  vy: (Math.random() - 0.5) * 120,
                  color: ["#34d399", "#60a5fa", "#f59e0b", "#fbbf24"][
                    Math.floor(Math.random() * 4)
                  ],
                  life: 0.9,
                  maxLife: 0.9,
                  size: 3,
                });
              }
            }
          }
        } else if (r.mode === "Home") {
          // Gentle wandering inside town perimeter
          const wanderAngle = s.time * 0.4 + r.townIndex;
          const targetWanderX = s.townX + Math.cos(wanderAngle) * 35;
          const targetWanderY = s.townY + Math.sin(wanderAngle) * 25;
          r.x += (targetWanderX - r.x) * 0.8 * dt;
          r.y += (targetWanderY - r.y) * 0.8 * dt;
        }

        // Enemy melee damage to refugee
        s.enemies.forEach((e) => {
          const ed = Math.hypot(e.x - r.x, e.y - r.y);
          if (ed < 16) {
            r.hp -= e.damage * dt;
            r.flash = 0.15;
            if (r.speechTimer <= 0) {
              r.spoken = "Help! They're attacking!";
              r.speechTimer = 2.0;
            }
          }
        });

        // Refugee death
        if (r.hp <= 0) {
          for (let i = 0; i < 16; i++) {
            s.particles.push({
              x: r.x,
              y: r.y - 8,
              vx: (Math.random() - 0.5) * 80,
              vy: (Math.random() - 0.5) * 80,
              color: "#ef4444",
              life: 0.7,
              maxLife: 0.7,
              size: 3,
            });
          }
          setAnnouncement("A REFUGEE WAS LOST TO THE DARK!");
          s.refugee = null;
        }
      }

      // 5. Loyal Hound Companion (Unlocked at 3 rescues)
      const hound = s.hound;
      if (hound) {
        // Find nearest hostile enemy
        let nearestEnemy: EnemyEntity | null = null;
        let nearestD = 140;
        s.enemies.forEach((e) => {
          const d = Math.hypot(e.x - hound.x, e.y - hound.y);
          if (d < nearestD) {
            nearestD = d;
            nearestEnemy = e;
          }
        });

        if (nearestEnemy) {
          // Pounce and bite enemy
          const target = nearestEnemy as EnemyEntity;
          const hdx = target.x - hound.x;
          const hdy = target.y - hound.y;
          const hd = Math.hypot(hdx, hdy);
          hound.x += (hdx / hd) * 80 * dt;
          hound.y += (hdy / hd) * 80 * dt;
          hound.facing = hdx < 0 ? -1 : 1;

          if (hd < 14) {
            target.hp -= 22 * dt;
            s.particles.push({
              x: target.x,
              y: target.y,
              vx: (Math.random() - 0.5) * 40,
              vy: -Math.random() * 30,
              color: "#fbbf24",
              life: 0.25,
              maxLife: 0.25,
              size: 2,
            });
          }
        } else {
          // Heel beside player
          const targetX = p.x - p.facing * 18;
          const targetY = p.y + 12;
          hound.x += (targetX - hound.x) * 4.0 * dt;
          hound.y += (targetY - hound.y) * 4.0 * dt;
          hound.facing = p.facing;
        }
      }

      // 6. Watchtower Defense & Ballistic Targeting
      const tower = s.watchtower;
      tower.reload = Math.max(0, tower.reload - dt);
      const TOWER_RANGE = towerFortified ? 190 : 130;
      const TOWER_RELOAD_TIME = towerFortified ? 1.0 : 1.6;

      if (tower.reload <= 0) {
        // Target closest hostile in range
        let bestFoe: EnemyEntity | null = null;
        let bestDist2 = TOWER_RANGE * TOWER_RANGE;

        s.enemies.forEach((e) => {
          const dx = e.x - tower.x;
          const dy = e.y - (tower.y - 30);
          const d2 = dx * dx + dy * dy;
          if (d2 < bestDist2) {
            bestDist2 = d2;
            bestFoe = e;
          }
        });

        if (bestFoe) {
          const target = bestFoe as EnemyEntity;
          const dx = target.x - tower.x;
          const dy = target.y - (tower.y - 30);
          const d = Math.hypot(dx, dy);
          s.arrows.push({
            x: tower.x,
            y: tower.y - 30,
            vx: (dx / d) * 280,
            vy: (dy / d) * 280,
            life: 1.2,
          });
          tower.reload = TOWER_RELOAD_TIME;
          tower.shots++;
        }
      }

      // 7. Arrow Kinematics & Collisions
      s.arrows = s.arrows.filter((a) => {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.life -= dt;

        let hit = false;
        s.enemies.forEach((e) => {
          if (!hit && Math.hypot(e.x - a.x, e.y - a.y) < 14) {
            hit = true;
            e.hp -= 18;
            for (let i = 0; i < 6; i++) {
              s.particles.push({
                x: a.x,
                y: a.y,
                vx: (Math.random() - 0.5) * 60,
                vy: (Math.random() - 0.5) * 60,
                color: "#e2e8f0",
                life: 0.35,
                maxLife: 0.35,
                size: 2,
              });
            }
          }
        });
        return !hit && a.life > 0;
      });

      // 8. Enemy Movement (Flocking toward Refugee or Player)
      s.enemies.forEach((e) => {
        // Enemies target refugee if close, otherwise target player
        const targetX =
          r && r.mode !== "Home" && Math.hypot(e.x - r.x, e.y - r.y) < 220
            ? r.x
            : p.x;
        const targetY =
          r && r.mode !== "Home" && Math.hypot(e.x - r.x, e.y - r.y) < 220
            ? r.y
            : p.y;
        const edx = targetX - e.x;
        const edy = targetY - e.y;
        const ed = Math.hypot(edx, edy);
        if (ed > 8) {
          e.vx = (edx / ed) * e.speed;
          e.vy = (edy / ed) * e.speed;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.facing = e.vx < 0 ? -1 : 1;
        }
      });

      // Remove dead enemies
      s.enemies = s.enemies.filter((e) => {
        if (e.hp <= 0) {
          for (let i = 0; i < 10; i++) {
            s.particles.push({
              x: e.x,
              y: e.y,
              vx: (Math.random() - 0.5) * 70,
              vy: (Math.random() - 0.5) * 70,
              color: "#a855f7",
              life: 0.5,
              maxLife: 0.5,
              size: 2.5,
            });
          }
          return false;
        }
        return true;
      });

      // 9. Particle Updates
      s.particles = s.particles.filter((pt) => {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        return pt.life > 0;
      });

      // ==========================================
      // RENDERING CANVAS (600x380)
      // ==========================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background terrain gradient (Night vs Day)
      const bgGrad = ctx.createRadialGradient(
        s.townX,
        s.townY,
        40,
        s.townX,
        s.townY,
        340
      );
      if (isNight) {
        bgGrad.addColorStop(0, "#1a162b");
        bgGrad.addColorStop(0.4, "#0e0c18");
        bgGrad.addColorStop(1, "#05040a");
      } else {
        bgGrad.addColorStop(0, "#1e2a22");
        bgGrad.addColorStop(0.5, "#131a15");
        bgGrad.addColorStop(1, "#0a0e0b");
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle terrain grid & rocks
      ctx.strokeStyle = isNight
        ? "rgba(100, 116, 139, 0.08)"
        : "rgba(52, 211, 153, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Town Safe Boundary Perimeter
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = isNight
        ? "rgba(245, 158, 11, 0.35)"
        : "rgba(16, 185, 129, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.townX, s.townY, s.townRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Town Hearth Glow
      const hearthGrad = ctx.createRadialGradient(
        s.townX,
        s.townY,
        10,
        s.townX,
        s.townY,
        s.townRadius
      );
      hearthGrad.addColorStop(
        0,
        isNight ? "rgba(245, 158, 11, 0.4)" : "rgba(251, 191, 36, 0.25)"
      );
      hearthGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = hearthGrad;
      ctx.beginPath();
      ctx.arc(s.townX, s.townY, s.townRadius, 0, Math.PI * 2);
      ctx.fill();

      // Town Campfire icon
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(
        s.townX,
        s.townY,
        8 + Math.sin(s.time * 8) * 1.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 9px monospace";
      ctx.fillText("TOWN HEARTH", s.townX - 28, s.townY + 22);

      // Watchtower Range & Body
      const tw = s.watchtower;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.beginPath();
      ctx.arc(tw.x, tw.y - 30, TOWER_RANGE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Watchtower Structure
      ctx.fillStyle = "#334155";
      ctx.fillRect(tw.x - 10, tw.y - 28, 20, 28);
      ctx.fillStyle = "#475569";
      ctx.fillRect(tw.x - 14, tw.y - 36, 28, 8);
      // Flame light atop tower
      const flameFlicker = Math.sin(s.time * 9) * 2;
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(tw.x, tw.y - 40, 5 + flameFlicker * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#38bdf8";
      ctx.font = "9px monospace";
      ctx.fillText(
        `TOWER (Shots: ${tw.shots})`,
        tw.x - 38,
        tw.y - 48
      );

      // Leash Line (if Following)
      if (r && r.mode === "Following") {
        const ld = Math.hypot(p.x - r.x, p.y - r.y);
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle =
          ld > 140
            ? "rgba(239, 68, 68, 0.85)"
            : ld > 90
            ? "rgba(245, 158, 11, 0.8)"
            : "rgba(52, 211, 153, 0.75)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(r.x, r.y);
        ctx.stroke();
        ctx.restore();
      }

      // Arrows
      s.arrows.forEach((a) => {
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x - a.vx * 0.04, a.y - a.vy * 0.04);
        ctx.stroke();
      });

      // Enemies
      s.enemies.forEach((e) => {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle =
          e.kind === "Wolf"
            ? "#dc2626"
            : e.kind === "Shade"
            ? "#9333ea"
            : "#71717a";

        // Draw enemy creature
        ctx.beginPath();
        ctx.arc(0, 0, e.kind === "Wolf" ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();

        // Eye glow
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(e.facing > 0 ? 2 : -5, -3, 3, 2);

        // HP bar
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(-10, -14, 20, 3);
        ctx.fillStyle = "#ef4444";
        const maxHp = e.kind === "Wolf" ? 28 : e.kind === "Shade" ? 18 : 12;
        ctx.fillRect(-10, -14, (e.hp / maxHp) * 20, 3);
        ctx.restore();
      });

      // Loyal Hound
      if (hound) {
        ctx.save();
        ctx.translate(hound.x, hound.y);
        ctx.fillStyle = "#d97706";
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#b45309";
        ctx.fillRect(hound.facing > 0 ? 4 : -7, -4, 4, 4); // snout
        ctx.fillStyle = "#fef08a";
        ctx.font = "8px monospace";
        ctx.fillText("HOUND", -14, -8);
        ctx.restore();
      }

      // Player Hero
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0284c7";
      ctx.fillRect(p.facing > 0 ? 3 : -7, -2, 5, 4); // shield / kit
      ctx.fillStyle = "#e0f2fe";
      ctx.font = "bold 9px monospace";
      ctx.fillText("HERO", -11, -12);
      ctx.restore();

      // Refugee Entity
      if (r) {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.fillStyle =
          r.flash > 0
            ? "#f87171"
            : r.mode === "Home"
            ? "#34d399"
            : r.mode === "Following"
            ? "#60a5fa"
            : "#fbbf24";

        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();

        // Shivering / posture
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(-2 + r.shiver, -1, 4, 3);

        // HP bar if outside home
        if (r.mode !== "Home") {
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
          ctx.fillRect(-12, -15, 24, 3);
          ctx.fillStyle = "#10b981";
          ctx.fillRect(-12, -15, (r.hp / r.maxHp) * 24, 3);
        }

        // Mode label
        ctx.fillStyle =
          r.mode === "Home"
            ? "#34d399"
            : r.mode === "Following"
            ? "#60a5fa"
            : "#f59e0b";
        ctx.font = "bold 9px monospace";
        ctx.fillText(
          `${r.mode.toUpperCase()}`,
          -16,
          r.mode !== "Home" ? -19 : -11
        );

        // Speech Bubble
        if (r.spoken && r.speechTimer > 0) {
          ctx.font = "10px sans-serif";
          const tw = ctx.measureText(r.spoken).width;
          const bubbleW = tw + 14;
          const bubbleH = 20;
          ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
          ctx.strokeStyle =
            r.mode === "Lost" ? "#f59e0b" : "#38bdf8";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(-bubbleW / 2, -44, bubbleW, bubbleH, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#f8fafc";
          ctx.fillText(r.spoken, -bubbleW / 2 + 7, -30);
        }
        ctx.restore();
      }

      // Particles
      s.particles.forEach((pt) => {
        ctx.save();
        ctx.globalAlpha = pt.life / pt.maxLife;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [isNight, autoHero, towerFortified, spawnEnemy]);

  const vendorDiscountPct = Math.min(25, rescuedCount * 5);

  return (
    <div className="my-8 rounded-2xl border border-dark-750 bg-[#0d0b16] shadow-2xl overflow-hidden font-sans">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-950/40 via-dark-900 to-dark-950 border-b border-dark-750 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-inner">
            <TowerControl className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Refugee Escort &amp; Watchtower Defense Simulator
              <span className="px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                v0.6.0 Campaign
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Interactive 60 Hz simulation of <code>Townsfolk.cpp</code> state
              machines, leash breadcrumbs &amp; <code>Watchtower.cpp</code> arrow
              ballistics.
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-dark-950/80 p-1 rounded-xl border border-dark-800">
          <button
            type="button"
            onClick={() => setActiveTab("simulator")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "simulator"
                ? "bg-amber-500 text-dark-950 font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Live Simulator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("statemachine")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "statemachine"
                ? "bg-amber-500 text-dark-950 font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            State Machine
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("progression")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "progression"
                ? "bg-amber-500 text-dark-950 font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Milestones &amp; Hound
          </button>
        </div>
      </div>

      {activeTab === "simulator" && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* Announcement Bar */}
          <div className="p-2.5 rounded-xl bg-dark-900 border border-amber-500/30 flex items-center justify-between text-xs font-mono text-amber-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>{announcement}</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span>
                Rescued:{" "}
                <strong className="text-emerald-400 font-bold">
                  {rescuedCount}
                </strong>
              </span>
              <span>
                Materials:{" "}
                <strong className="text-amber-400 font-bold">
                  {materials}
                </strong>
              </span>
              <span>
                Discount:{" "}
                <strong className="text-sky-400 font-bold">
                  {vendorDiscountPct}%
                </strong>
              </span>
            </div>
          </div>

          {/* Canvas Viewport */}
          <div className="relative rounded-xl border border-dark-750 overflow-hidden bg-black shadow-inner flex justify-center">
            <canvas
              ref={canvasRef}
              width={600}
              height={380}
              onClick={handleCanvasClick}
              className="cursor-crosshair block w-full max-w-[600px] h-[380px]"
            />

            {/* Quick Canvas Overlay Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 text-[11px] font-mono pointer-events-none">
              <span className="px-2 py-0.5 rounded bg-dark-950/80 border border-dark-750 text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Click canvas to guide Hero (WASD / Autopilot)
              </span>
              {rescuedCount >= 3 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1.5">
                  <Dog className="w-3 h-3 text-amber-400" />
                  Loyal Hound Active (Companion Defense)
                </span>
              )}
            </div>

            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsNight((n) => !n)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono border flex items-center gap-1.5 transition-colors ${
                  isNight
                    ? "bg-purple-950/80 border-purple-500 text-purple-200"
                    : "bg-amber-950/80 border-amber-500 text-amber-200"
                }`}
              >
                {isNight ? (
                  <Moon className="w-3.5 h-3.5 text-purple-400" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                )}
                {isNight ? "Night Spawns" : "Daylight Calm"}
              </button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={spawnRefugee}
              className="p-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 hover:border-amber-500/40 text-xs font-mono text-slate-200 flex items-center justify-center gap-2 transition-all"
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              Spawn Lost Refugee
            </button>
            <button
              type="button"
              onClick={() => spawnEnemy("Wolf")}
              className="p-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 hover:border-rose-500/40 text-xs font-mono text-slate-200 flex items-center justify-center gap-2 transition-all"
            >
              <Sword className="w-3.5 h-3.5 text-rose-400" />
              Spawn Wild Foe
            </button>
            <button
              type="button"
              onClick={() => setAutoHero((a) => !a)}
              className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-center gap-2 transition-all ${
                autoHero
                  ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                  : "bg-dark-850 border-dark-700 text-slate-400"
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              Auto-Pilot Hero: {autoHero ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onClick={resetSimulation}
              className="p-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 text-xs font-mono text-slate-300 flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              Reset Field
            </button>
          </div>
        </div>
      )}

      {activeTab === "statemachine" && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-dark-900 border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
                <AlertTriangle className="w-4 h-4" />
                Mode::Lost
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Spawns stranded in the wild wilderness. Shivers and emits
                distress calls. If enemies approach, takes damage without
                fighting back. Transitions to <code>Following</code> when
                the Player enters within <code>CALL = 28</code> units.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-dark-900 border border-sky-500/30">
              <div className="flex items-center gap-2 text-sky-400 font-bold mb-2">
                <ArrowRight className="w-4 h-4" />
                Mode::Following
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Trails player breadcrumbs at <code>TRAIL = 50</code> speed.
                Checks <code>LEASH = 260</code> distance every tick: if the
                hero sprints too far ahead, the leash snaps back to{" "}
                <code>Lost</code>. Transitions to <code>Home</code> upon reaching
                town boundaries.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-dark-900 border border-emerald-500/30">
              <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
                <Shield className="w-4 h-4" />
                Mode::Home
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Settles permanently into the local town council. Grants{" "}
                <strong>+3 Crafting Materials</strong>, increments global{" "}
                <code>rescued</code> count, increases merchant discount by 5%,
                and gathers near the campfire during nocturnal waves.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#08070d] border border-dark-800 text-xs font-mono text-slate-300 space-y-2">
            <div className="text-amber-400 font-bold mb-1">
              Exact Invariants from Townsfolk.hpp:
            </div>
            <div>
              <span className="text-slate-500">SPEED:</span> 18 px/s (Calm
              village wander velocity)
            </div>
            <div>
              <span className="text-slate-500">TRAIL:</span> 50 px/s (Hero
              escort trailing speed limit)
            </div>
            <div>
              <span className="text-slate-500">CALL:</span> 28 px (Rescue
              activation trigger radius)
            </div>
            <div>
              <span className="text-slate-500">LEASH:</span> 260 px (Maximum
              separation before leash break)
            </div>
            <div>
              <span className="text-slate-500">HP:</span> 40.0f (Vulnerable to
              wilderness predators)
            </div>
          </div>
        </div>
      )}

      {activeTab === "progression" && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="p-4 rounded-xl bg-dark-900 border border-dark-800">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
              <Dog className="w-4 h-4 text-amber-400" />
              The Loyal Hound Companion (Milestone: 3 Rescues)
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Upon delivering the third refugee, the townspeople bestow their
              devoted hunting hound upon the hero. The hound features
              autonomous combat steering, bites enemies targeting the hero or
              following refugees, and automatically teleports home if downed,
              reviving fresh at dawn!
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-dark-950 border border-dark-800">
                <span className="text-slate-500 block mb-1">
                  Hound Damage Formula:
                </span>
                <span className="text-emerald-400 font-bold">
                  damage = 6.0f + 2.0f * Player::lvl
                </span>
              </div>
              <div className="p-3 rounded-lg bg-dark-950 border border-dark-800">
                <span className="text-slate-500 block mb-1">
                  Dawn Regeneration:
                </span>
                <span className="text-sky-400 font-bold">
                  level.night.dawn == true &rarr; revive()
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-dark-900 border border-dark-800">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-amber-400" />
              Watchtower Fortification Invariants (Watchtower.hpp)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-dark-950 border border-dark-800">
                <span className="text-slate-500 block">Archer Range:</span>
                <span className="text-amber-300 font-bold">RANGE = 190 px</span>
              </div>
              <div className="p-3 rounded-lg bg-dark-950 border border-dark-800">
                <span className="text-slate-500 block">Arrow Velocity:</span>
                <span className="text-amber-300 font-bold">260 px/s</span>
              </div>
              <div className="p-3 rounded-lg bg-dark-950 border border-dark-800">
                <span className="text-slate-500 block">Reload Cadence:</span>
                <span className="text-amber-300 font-bold">RELOAD = 1.1s</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
