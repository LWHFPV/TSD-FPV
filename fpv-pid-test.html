
(() => {
  "use strict";

  const RAD = Math.PI / 180;
  const G = 9.81;
  const HOVER = 0.37;
  const CAMERA_TILT = 35 * RAD;
  const FORWARD_PITCH = -35 * RAD;

  const clamp = (x, a, b) =>
    Math.max(a, Math.min(b, x));

  const state = {
    mode: "hover",
    time: 0,
    position: { x: 0, y: 0, z: 6 },
    velocity: { x: 0, y: 0, z: 0 },
    attitude: { roll: 0, pitch: 0, yaw: 0 },
    rates: { roll: 0, pitch: 0, yaw: 0 },
    target: { roll: 0, pitch: 0, yaw: 0 },
    pid: { p: 47, i: 84, d: 34 },
    integral: { roll: 0, pitch: 0, yaw: 0 },
    throttle: HOVER,
    cameraTilt: CAMERA_TILT,
    phase: 0,
    phaseTime: 0,
    altitudeTarget: 6,
    running: true
  };

  function reset() {
    state.mode = "hover";
    state.time = 0;
    state.position = { x: 0, y: 0, z: 6 };
    state.velocity = { x: 0, y: 0, z: 0 };
    state.attitude = {
      roll: 0, pitch: 0, yaw: 0
    };
    state.rates = {
      roll: 0, pitch: 0, yaw: 0
    };
    state.target = {
      roll: 0, pitch: 0, yaw: 0
    };
    state.integral = {
      roll: 0, pitch: 0, yaw: 0
    };
    state.throttle = HOVER;
    state.phase = 0;
    state.phaseTime = 0;
    state.altitudeTarget = 6;
    state.running = true;
  }

  function setMode(mode) {
    if (!["hover", "forward",
          "splitL", "splitR"].includes(mode)) {
      return;
    }

    state.mode = mode;
    state.phase = 0;
    state.phaseTime = 0;

    state.target.roll = 0;
    state.target.pitch = 0;
    state.target.yaw = state.attitude.yaw;

    state.integral.roll = 0;
    state.integral.pitch = 0;
    state.integral.yaw = 0;

    state.altitudeTarget = state.position.z;
  }

  function updateTargets(dt) {
    const t = state.phaseTime;

    if (state.mode === "hover") {
      state.target.roll = 0;
      state.target.pitch = 0;
      return;
    }

    if (state.mode === "forward") {
      state.target.roll = 0;
      state.target.pitch = FORWARD_PITCH;
      return;
    }

    const direction =
      state.mode === "splitL" ? -1 : 1;

    // 교육용 Split-S 근사 기동:
    // 반 롤 -> 반 루프 -> 자세 복구
    if (state.phase === 0) {
      state.target.roll = direction * Math.PI;
      state.target.pitch = 0;

      if (t > 1.8) {
        state.phase = 1;
        state.phaseTime = 0;
      }
    } else if (state.phase === 1) {
      state.target.roll = direction * Math.PI;
      state.target.pitch = -Math.PI;

      if (t > 2.5) {
        state.phase = 2;
        state.phaseTime = 0;
      }
    } else {
      state.target.roll = 0;
      state.target.pitch = 0;

      if (t > 2) {
        setMode("hover");
      }
    }
  }

  function wrapAngle(a) {
    return Math.atan2(Math.sin(a), Math.cos(a));
  }

  function controlAxis(axis, dt) {
    const actual = state.attitude[axis];
    const target = state.target[axis];

    const error = wrapAngle(target - actual);

    const kp = state.pid.p * 0.12;
    const ki = state.pid.i * 0.008;
    const kd = state.pid.d * 0.035;

    state.integral[axis] = clamp(
      state.integral[axis] + error * dt,
      -1.5, 1.5
    );

    const acceleration =
      kp * error +
      ki * state.integral[axis] -
      kd * state.rates[axis];

    state.rates[axis] = clamp(
      state.rates[axis] + acceleration * dt,
      -8, 8
    );

    state.attitude[axis] +=
      state.rates[axis] * dt;
  }

  function updatePhysics(dt) {
    const a = state.attitude;
    const v = state.velocity;
    const p = state.position;

    // 기울어진 기체의 수직 추력 감소
    const verticalFactor =
      Math.cos(a.roll) * Math.cos(a.pitch);

    // 고도 유지 보조 제어
    const heightError =
      state.altitudeTarget - p.z;

    const verticalSpeedError = -v.z;

    const desiredVerticalAcceleration =
      clamp(
        heightError * 1.8 +
        verticalSpeedError * 1.4,
        -4, 4
      );

    const desiredVerticalForce =
      G + desiredVerticalAcceleration;

    // 자세 변화에 따른 스로틀 보상
    const compensation =
      desiredVerticalForce /
      (G * Math.max(verticalFactor, 0.2));

    state.throttle = clamp(
      HOVER * compensation,
      0, 1
    );

    // 스로틀 37%에서 중력과 평형
    const thrustAcceleration =
      G * state.throttle / HOVER;

    // 간략화된 전진/측면 추력 모델
    const forwardAcceleration =
      -Math.sin(a.pitch) *
      thrustAcceleration;

    const sideAcceleration =
      Math.sin(a.roll) *
      thrustAcceleration;

    const verticalAcceleration =
      thrustAcceleration * verticalFactor - G;

    const cy = Math.cos(a.yaw);
    const sy = Math.sin(a.yaw);

    const ax =
      cy * forwardAcceleration -
      sy * sideAcceleration;

    const ay =
      sy * forwardAcceleration +
      cy * sideAcceleration;

    // 공기 저항
    v.x += (ax - v.x * 0.15) * dt;
    v.y += (ay - v.y * 0.15) * dt;
    v.z += (verticalAcceleration -
            v.z * 0.12) * dt;

    p.x += v.x * dt;
    p.y += v.y * dt;
    p.z += v.z * dt;

    if (p.z <= 0) {
      p.z = 0;
      v.z = Math.max(0, v.z);
      state.running = false;
    }
  }

  function step(dt) {
    if (!state.running) return;

    dt = clamp(dt, 0, 0.02);

    state.time += dt;
    state.phaseTime += dt;

    updateTargets(dt);

    controlAxis("roll", dt);
    controlAxis("pitch", dt);
    controlAxis("yaw", dt);

    updatePhysics(dt);
  }

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  window.TSDFlight = {
    state,
    reset,
    setMode,
    step,
    snapshot,
    constants: {
      hoverThrottle: HOVER,
      cameraTilt: CAMERA_TILT,
      forwardPitch: FORWARD_PITCH
    }
  };
})();
