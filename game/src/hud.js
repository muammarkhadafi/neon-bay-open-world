// Neon Bay — the HUD: DOM bars and text, plus a canvas minimap (a top-down
// look at the city: the player, cars, police, the mission marker, the hideout).

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['health-fill', 'health-text', 'money', 'stars', 'speed', 'objective', 'message', 'ammo', 'mission-label', 'clock']) {
      this.el[id] = document.getElementById(id);
    }
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map ? this.map.getContext('2d') : null;
    this.messageTimer = 0;
  }

  showMessage(text, seconds) {
    if (!this.el.message) return;
    this.el.message.textContent = text;
    this.el.message.style.opacity = '1';
    this.messageTimer = seconds || 4;
  }

  update(dt, state) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0 && this.el.message) this.el.message.style.opacity = '0';
    }
    if (this.el['health-fill']) this.el['health-fill'].style.width = `${state.health}%`;
    if (this.el['health-text']) this.el['health-text'].textContent = `HP ${Math.ceil(state.health)}`;
    if (this.el.money) this.el.money.textContent = `$${state.money.toLocaleString('en-US')}`;
    if (this.el.stars) {
      this.el.stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
      this.el.stars.style.color = state.wanted > 0 ? '#ffd23f' : '#888';
    }
    if (this.el.speed) this.el.speed.textContent = state.inCar ? `${Math.round(Math.abs(state.speed) * 3.6)} km/h` : 'On foot';
    if (this.el.ammo) this.el.ammo.textContent = state.reloading ? 'Reloading…' : `Ammo ${state.ammo}/${state.ammoMax}`;
    if (this.el['mission-label']) {
      this.el['mission-label'].textContent = state.missionTitle || 'No mission — go to the gold marker at the hideout';
    }
    if (this.el.objective) this.el.objective.textContent = state.objective || '';
    if (this.el.clock && state.timeLeft != null) {
      const t = Math.max(0, Math.ceil(state.timeLeft));
      this.el.clock.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      this.el.clock.style.display = state.timeLeft != null ? 'block' : 'none';
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const S = this.map.width;
    const span = 460; // world units across the map
    const toMap = (x, z) => [((x + span / 2) / span) * S, ((z + span / 2) / span) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#16202b';
    ctx.fillRect(0, 0, S, S);
    // Roads.
    ctx.strokeStyle = '#3a4450';
    ctx.lineWidth = 5;
    for (const c of state.roadCenters) {
      const [mx] = toMap(c, 0);
      const [, mz] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, mz); ctx.lineTo(S, mz); ctx.stroke();
    }
    // Beach and ocean.
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(0, S - 14, S, 14);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, S - 20, S, 6);
    const dot = (x, z, color, r) => {
      const [mx, mz] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx, mz, r, 0, Math.PI * 2); ctx.fill();
    };
    if (state.hideout) dot(state.hideout.x, state.hideout.z, '#8888ff', 4);
    if (state.missionTarget) dot(state.missionTarget.x, state.missionTarget.z, '#ffd23f', 5);
    for (const c of state.policeCars || []) dot(c.x, c.z, '#ff4444', 3);
    for (const c of state.cars || []) dot(c.x, c.z, '#dddddd', 2);
    for (const p of state.peds || []) dot(p.x, p.z, '#7fb069', 1.5);
    // Player arrow.
    const [px, pz] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.atan2(Math.sin(state.heading), Math.cos(state.heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
