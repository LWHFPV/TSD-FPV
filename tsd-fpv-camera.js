
(() => {
  "use strict";

  const flight = window.TSDFlight;
  const canvas = document.getElementById("fpv");
  const status = document.getElementById("status");

  if (!flight || !canvas) {
    if (status) {
      status.textContent = "엔진 연결 오류";
    }
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const RAD = Math.PI / 180;
  const W = canvas.width;
  const H = canvas.height;
  const F = W * 0.82;

  const clamp = (x, a, b) =>
    Math.max(a, Math.min(b, x));

  // 월드 좌표: X 전방, Y 우측, Z 위쪽
  // 기체 좌표: X 전방, Y 우측, Z 위쪽
  function worldToCamera(point, s) {
    let x = point.x - s.position.x;
    let y = point.y - s.position.y;
    let z = point.z - s.position.z;

    const yaw = -s.attitude.yaw;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);

    let xx = cy * x - sy * y;
    let yy = sy * x + cy * y;
    x = xx;
    y = yy;

    const roll = -s.attitude.roll;
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);

    yy = cr * y - sr * z;
    let zz = sr * y + cr * z;
    y = yy;
    z = zz;

    // 카메라가 기체에 대해 35도 위를 향함
    const pitch =
      -(s.attitude.pitch + s.cameraTilt);

    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);

    xx = cp * x + sp * z;
    zz = -sp * x + cp * z;

    return { x: xx, y, z: zz };
  }

  function project(point, s) {
    const v = worldToCamera(point, s);

    if (v.x <= 0.2) return null;

    return {
      x: W / 2 + F * v.y / v.x,
      y: H / 2 - F * v.z / v.x,
      depth: v.x
    };
  }

  function line3(a, b, s, color, width = 2) {
    const pa = project(a, s);
    const pb = project(b, s);

    if (!pa || !pb) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  function polygon3(points, s, color) {
    const projected = points.map(p => project(p, s));

    if (projected.some(p => !p)) return;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(projected[0].x, projected[0].y);

    for (let i = 1; i < projected.length; i++) {
      ctx.lineTo(projected[i].x, projected[i].y);
    }

    ctx.closePath();
    ctx.fill();
  }

  function terrainHeight(x, y) {
    const distant =
      4 * Math.sin(x * 0.012) *
      Math.cos(y * 0.015);

    const small =
      0.5 * Math.sin(x * 0.11 + y * 0.08);

    return Math.max(0, distant + small);
  }

  function drawSky() {
    const grad = ctx.createLinearGradient(
      0, 0, 0, H
    );

    grad.addColorStop(0, "#143d69");
    grad.addColorStop(0.65, "#78b8dd");
    grad.addColorStop(1, "#d5e4d2");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTerrain(s) {
    // 거리별 지형 타일
    const tile = 20;
    const cx = Math.floor(s.position.x / tile);
    const cy = Math.floor(s.position.y / tile);

    const cells = [];

    for (let i = -3; i <= 12; i++) {
      for (let j = -9; j <= 9; j++) {
        const x = (cx + i) * tile;
        const y = (cy + j) * tile;

        const points = [
          { x, y, z: terrainHeight(x, y) },
          {
            x: x + tile, y,
            z: terrainHeight(x + tile, y)
          },
          {
            x: x + tile, y: y + tile,
            z: terrainHeight(x + tile, y + tile)
          },
          {
            x, y: y + tile,
            z: terrainHeight(x, y + tile)
          }
        ];

        const distance =
          Math.hypot(
            x - s.position.x,
            y - s.position.y
          );

        cells.push({ points, distance, i, j });
      }
    }

    cells.sort((a, b) => b.distance - a.distance);

    for (const cell of cells) {
      const alternate =
        (cell.i + cell.j) % 2 === 0;

      polygon3(
        cell.points,
        s,
        alternate ? "#547f56" : "#648c5d"
      );
    }
  }

  function drawRunway(s) {
    const z = 0.12;

    polygon3([
      { x: -40, y: -7, z },
      { x: 260, y: -7, z },
      { x: 260, y: 7, z },
      { x: -40, y: 7, z }
    ], s, "#555e65");

    for (let x = -30; x < 260; x += 18) {
      polygon3([
        { x, y: -0.3, z: z + 0.03 },
        { x: x + 9, y: -0.3, z: z + 0.03 },
        { x: x + 9, y: 0.3, z: z + 0.03 },
        { x, y: 0.3, z: z + 0.03 }
      ], s, "#e7e8d9");
    }
  }

  function drawGate(x, y, s, color) {
    const z = terrainHeight(x, y);
    const width = 7;
    const height = 7;

    const a = { x, y: y - width / 2, z };
    const b = { x, y: y - width / 2, z: z + height };
    const c = { x, y: y + width / 2, z: z + height };
    const d = { x, y: y + width / 2, z };

    line3(a, b, s, color, 5);
    line3(b, c, s, color, 5);
    line3(c, d, s, color, 5);
  }

  function drawObstacles(s) {
    for (let i = 0; i < 12; i++) {
      const x = 30 + i * 35;
      const y = i % 2 === 0 ? -20 : 20;
      const z = terrainHeight(x, y);

      const top = { x, y, z: z + 11 };
      const base = { x, y, z };

      line3(base, top, s, "#d9c6a0", 6);

      for (let j = 0; j < 3; j++) {
        const h = 6 + j * 2;

        line3(
          { x, y: y - 2.5, z: z + h },
          { x, y: y + 2.5, z: z + h },
          s,
          "#d9c6a0",
          2
        );
      }
    }

    drawGate(45, 0, s, "#ffb44e");
    drawGate(90, 0, s, "#66e5ff");
    drawGate(145, 0, s, "#ffb44e");
    drawGate(210, 0, s, "#66e5ff");
  }

  function drawHUD(s) {
    const speed = Math.hypot(
      s.velocity.x,
      s.velocity.y,
      s.velocity.z
    ) * 3.6;

    const pitch = s.attitude.pitch / RAD;
    const roll = s.attitude.roll / RAD;

    ctx.fillStyle = "rgba(4,15,27,0.65)";
    ctx.fillRect(10, 10, 330, 112);

    ctx.fillStyle = "#e7faff";
    ctx.font = "19px monospace";

    ctx.fillText(
      `ALT ${s.position.z.toFixed(1)}m`,
      22, 35
    );

    ctx.fillText(
      `SPD ${speed.toFixed(1)}km/h`,
      22, 61
    );

    ctx.fillText(
      `THR ${(s.throttle * 100).toFixed(1)}%`,
      22, 87
    );

    ctx.font = "16px monospace";
    ctx.fillText(
      `PITCH ${pitch.toFixed(1)}  ROLL ${roll.toFixed(1)}`,
      22, 111
    );

    // 중앙 조준선
    ctx.strokeStyle = "#a9ffda";
    ctx.lineWidth = 2;
    ctx.beginPath();

    ctx.moveTo(W / 2 - 24, H / 2);
    ctx.lineTo(W / 2 - 8, H / 2);

    ctx.moveTo(W / 2 + 8, H / 2);
    ctx.lineTo(W / 2 + 24, H / 2);

    ctx.moveTo(W / 2, H / 2 - 10);
    ctx.lineTo(W / 2, H / 2 + 10);
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "18px monospace";
    ctx.fillText(
      `MODE ${s.mode.toUpperCase()}`,
      15, H - 18
    );
  }

  function draw(s) {
    drawSky();
    drawTerrain(s);
    drawRunway(s);
    drawObstacles(s);
    drawHUD(s);
  }

  function connectButton(id, mode) {
    const button = document.getElementById(id);
    if (!button) return;

    button.addEventListener("click", () => {
      flight.setMode(mode);
    });
  }

  connectButton("hover", "hover");
  connectButton("forward", "forward");
  connectButton("splitL", "splitL");
  connectButton("splitR", "splitR");

  document.getElementById("reset")
    ?.addEventListener("click", () => {
      flight.reset();
    });

  for (const axis of ["p", "i", "d"]) {
    const slider = document.getElementById(axis);
    const output = document.getElementById(
      axis + "v"
    );

    if (!slider) continue;

    slider.addEventListener("input", () => {
      const value = Number(slider.value);

      flight.state.pid[axis] = value;

      if (output) {
        output.textContent = value;
      }
    });
  }

  let lastTime = 0;
  let accumulator = 0;

  function animate(time) {
    if (!lastTime) lastTime = time;

    const elapsed = clamp(
      (time - lastTime) / 1000,
      0, 0.05
    );

    lastTime = time;
    accumulator += elapsed;

    const dt = 1 / 120;
    let steps = 0;

    while (accumulator >= dt && steps < 8) {
      flight.step(dt);
      accumulator -= dt;
      steps++;
    }

    const s = flight.state;

    draw(s);

    if (status) {
      status.textContent = s.running
        ? `실행 중 · ${s.time.toFixed(1)}초`
        : "지면 충돌 · 초기화를 누르세요";
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
})();
