/* Shared numerical models. Mechanics uses SI; electromagnetic experiments use c=m=1. */
(function () {
  'use strict';
  const FD = window.FD,
    V = FD.V;
  const P = (FD.Physics = {});

  // Relativistic Boris: symmetric electric/drag kicks, norm-preserving magnetic rotation.
  // u = gamma*v (m=c=1). Explicit drag is applied in momentum space as -k*v.
  P.boris = function (velocity, E, B, q, drag, thrust, dt) {
    const v2 = V.len2(velocity);
    const gamma = 1 / Math.sqrt(Math.max(1e-12, 1 - v2));
    const half = dt / 2;
    const u = {
      x: gamma * velocity.x + half * (q * E.x - drag * velocity.x + thrust.x),
      y: gamma * velocity.y + half * (q * E.y - drag * velocity.y + thrust.y),
      z: gamma * velocity.z + half * (q * E.z - drag * velocity.z + thrust.z),
    };
    const gm = Math.sqrt(1 + V.len2(u));
    const t = V.mul(B, (q * half) / gm);
    const prime = V.add(u, V.cross(u, t));
    const rotated = V.add(u, V.cross(prime, V.mul(t, 2 / (1 + V.len2(t)))));
    const gr = Math.sqrt(1 + V.len2(rotated));
    rotated.x += half * (q * E.x - (drag * rotated.x) / gr + thrust.x);
    rotated.y += half * (q * E.y - (drag * rotated.y) / gr + thrust.y);
    rotated.z += half * (q * E.z - (drag * rotated.z) / gr + thrust.z);
    return V.mul(rotated, 1 / Math.sqrt(1 + V.len2(rotated)));
  };

  P.residual = function (E, B, v) {
    const magnetic = V.cross(v, B);
    const denominator = V.len(E) + V.len(magnetic);
    return denominator < 1e-12 ? 0 : V.len(V.add(E, magnetic)) / denominator;
  };

  P.rk4 = function (state, time, dt, derivative) {
    const a = derivative(state, time);
    const b = derivative(
      state.map((v, i) => v + (a[i] * dt) / 2),
      time + dt / 2,
    );
    const c = derivative(
      state.map((v, i) => v + (b[i] * dt) / 2),
      time + dt / 2,
    );
    const d = derivative(
      state.map((v, i) => v + c[i] * dt),
      time + dt,
    );
    return state.map((v, i) => v + (dt * (a[i] + 2 * b[i] + 2 * c[i] + d[i])) / 6);
  };

  P.pendulum = (s, length, damping) => [s[1], (-9.81 / length) * Math.sin(s[0]) - damping * s[1]];
  P.oscillator = (s, t, damping, frequency) => [
    s[1],
    -4 * s[0] - damping * s[1] + Math.cos(frequency * t),
  ];
  P.projectile = (s, drag) => [s[2], s[3], -drag * s[2], -9.81 - drag * s[3]];
  P.gravity = function (s) {
    const radius = Math.hypot(s[0], s[1]);
    const factor = -1 / Math.pow(Math.max(radius, 0.08), 3);
    return [s[2], s[3], factor * s[0], factor * s[1]];
  };
  P.induction = function (t, frequency, resistance) {
    const omega = 2 * Math.PI * frequency;
    const flux = Math.cos(omega * t); // N*A*B0 = 1 Wb
    const emf = omega * Math.sin(omega * t);
    return { flux, emf, current: emf / resistance, power: (emf * emf) / resistance };
  };
  P.standingWave = (x, t, mode) => Math.sin(mode * Math.PI * x) * Math.cos(mode * Math.PI * t);
})();
