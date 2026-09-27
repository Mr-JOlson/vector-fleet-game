(function (root) {
  const Z_SCALE = 0.4;

  function makeView(canvas, cssWidth, cssHeight) {
    const px = canvas.width / Math.max(cssWidth, 1);
    const field = (typeof VectorFleetPhysics !== "undefined" && VectorFleetPhysics.FIELD) || 100;
    const marginLeft = 64 * px;
    const marginRight = 36 * px;
    const marginTop = 22 * px;
    const marginBottom = 36 * px;
    const size = Math.min(
      canvas.width - marginLeft - marginRight,
      canvas.height - marginTop - marginBottom
    );
    const left = marginLeft + (canvas.width - marginLeft - marginRight - size) / 2;
    const top = marginTop + (canvas.height - marginTop - marginBottom - size) / 2;
    const scale = size / (field * 2);
    return {
      px,
      field,
      size,
      scale,
      left,
      top,
      originX: left + size / 2,
      originY: top + size / 2
    };
  }

  function worldToScreen(view, x, y, z) {
    return {
      x: view.originX + x * view.scale,
      y: view.originY - y * view.scale - (z || 0) * view.scale * Z_SCALE
    };
  }

  function drawGrid(ctx, view) {
    const px = view.px;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(view.left, view.top, view.size, view.size);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(view.left, view.top, view.size, view.size);

    const field = view.field;
    ctx.lineWidth = 1.25 * px;
    ctx.strokeStyle = "#000000";
    ctx.beginPath();
    for (let meter = -field; meter <= field; meter += 10) {
      const vertical = worldToScreen(view, meter, 0, 0).x;
      const horizontal = worldToScreen(view, 0, meter, 0).y;
      ctx.moveTo(vertical, view.top);
      ctx.lineTo(vertical, view.top + view.size);
      ctx.moveTo(view.left, horizontal);
      ctx.lineTo(view.left + view.size, horizontal);
    }
    ctx.stroke();

    ctx.lineWidth = 2.75 * px;
    ctx.beginPath();
    const origin = worldToScreen(view, 0, 0, 0);
    ctx.moveTo(view.left, origin.y);
    ctx.lineTo(view.left + view.size, origin.y);
    ctx.moveTo(origin.x, view.top);
    ctx.lineTo(origin.x, view.top + view.size);
    ctx.stroke();
    ctx.restore();

    ctx.lineWidth = 2 * px;
    ctx.strokeStyle = "#000000";
    ctx.strokeRect(view.left, view.top, view.size, view.size);

    ctx.fillStyle = "#000000";
    ctx.font = `600 ${Math.round(13 * px)}px "Segoe UI", "Avenir Next", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let meter = -field; meter <= field; meter += 20) {
      const x = worldToScreen(view, meter, 0, 0).x;
      ctx.fillText(String(meter), x, view.top + view.size + 6 * px);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let meter = -field; meter <= field; meter += 20) {
      const y = worldToScreen(view, 0, meter, 0).y;
      ctx.fillText(String(meter), view.left - 8 * px, y);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(14 * px)}px "Segoe UI", "Avenir Next", sans-serif`;
    ctx.fillText("+x", view.left + view.size + 4 * px, origin.y);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("+y", origin.x + 8 * px, view.top + 4 * px);

    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.font = `600 ${Math.round(13 * px)}px "Segoe UI", "Avenir Next", sans-serif`;
    ctx.fillStyle = "#0a2348";
    ctx.fillText("Shadow = map position. Curve = height.", view.left + view.size, view.top - 4 * px);
  }

  function drawTrail(ctx, view, trail, color) {
    if (trail.length < 2) return;
    const px = view.px;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    trail.forEach((point, index) => {
      const screen = worldToScreen(view, point.x, point.y, 0);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2 * px;
    ctx.setLineDash([7 * px, 6 * px]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    trail.forEach((point, index) => {
      const screen = worldToScreen(view, point.x, point.y, point.z);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 2.5 * px;
    ctx.stroke();
    ctx.restore();
  }

  function drawShip(ctx, view, ship, x, y, hpText, flashed, labelAbove) {
    const px = view.px;
    const screen = worldToScreen(view, x, y, 0);
    const radius = Math.max(2.35 * view.scale, 9 * px);
    const speed = Math.hypot(ship.vx, ship.vy);
    const angle = speed > 0.02
      ? Math.atan2(ship.vy, ship.vx)
      : (ship.direction * Math.PI) / 180;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(-angle);
    ctx.fillStyle = flashed ? "#fff6c2" : ship.color;
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1.6 * px;
    ctx.beginPath();
    ctx.moveTo(radius * 1.7, 0);
    ctx.lineTo(radius * 0.72, radius * 0.42);
    ctx.lineTo(radius * 0.72, -radius * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3 * px;
    ctx.strokeStyle = "#111111";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${Math.round(13 * px)}px "Segoe UI", "Avenir Next", sans-serif`;
    ctx.strokeText(hpText, screen.x, screen.y + 0.5 * px);
    ctx.fillText(hpText, screen.x, screen.y + 0.5 * px);
    ctx.font = `700 ${Math.round(12 * px)}px "Segoe UI", "Avenir Next", sans-serif`;
    ctx.lineWidth = 4 * px;
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#111111";
    const nameY = labelAbove ? screen.y - radius - 11 * px : screen.y + radius + 12 * px;
    ctx.strokeText(ship.name, screen.x, nameY);
    ctx.fillText(ship.name, screen.x, nameY);
    ctx.restore();
  }

  function drawProjectile(ctx, view, point, color) {
    const shadow = worldToScreen(view, point.x, point.y, 0);
    const body = worldToScreen(view, point.x, point.y, point.z);
    const px = view.px;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, 3.2 * px, 2 * px, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1 * px;
    ctx.beginPath();
    ctx.moveTo(shadow.x, shadow.y);
    ctx.lineTo(body.x, body.y);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1.4 * px;
    ctx.beginPath();
    ctx.arc(body.x, body.y, 4.5 * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(body.x, body.y, 1.7 * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSplash(ctx, view, splash) {
    const screen = worldToScreen(view, splash.x, splash.y, 0);
    const px = view.px;
    ctx.save();
    ctx.strokeStyle = splash.color;
    ctx.lineWidth = 2 * px;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 7 * px, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawExplosion(ctx, view, effect, age) {
    const life = 0.85;
    if (age < 0 || age > life) return;
    const fade = 1 - age / life;
    const screen = worldToScreen(view, effect.x, effect.y, 0);
    const px = view.px;
    const radius = (12 + age * 70) * px;
    const gradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius);
    gradient.addColorStop(0, `rgba(255, 255, 230, ${0.95 * fade})`);
    gradient.addColorStop(0.35, `rgba(255, 196, 40, ${0.75 * fade})`);
    gradient.addColorStop(0.7, `rgba(255, 90, 20, ${0.35 * fade})`);
    gradient.addColorStop(1, "rgba(255, 80, 0, 0)");
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fill();

    for (const spark of effect.sparks) {
      const sparkX = screen.x + spark.vx * age * view.scale;
      const sparkY = screen.y - spark.vy * age * view.scale;
      ctx.globalAlpha = fade;
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2.4 * px, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function shipPosition(ship, simTime, running) {
    if (!running) return { x: ship.x, y: ship.y };
    return {
      x: ship.x + ship.vx * simTime,
      y: ship.y + ship.vy * simTime
    };
  }

  function drawFrame(ctx, cssWidth, cssHeight, state, hpTextFor) {
    const view = makeView(ctx.canvas, cssWidth, cssHeight);
    drawGrid(ctx, view);

    ctx.save();
    ctx.beginPath();
    ctx.rect(view.left, view.top, view.size, view.size);
    ctx.clip();

    for (const splash of state.splashes) drawSplash(ctx, view, splash);
    for (const shot of state.shots) drawTrail(ctx, view, shot.trail, shot.color);

    const simTime = state.running ? state.simTime : 0;
    if (state.running) {
      for (const shot of state.shots) {
        if (state.simTime >= shot.endTime) continue;
        const point = shot.trail[shot.trail.length - 1];
        if (point) drawProjectile(ctx, view, point, shot.color);
      }
      for (const effect of state.effects) {
        drawExplosion(ctx, view, effect, state.simTime - effect.t);
      }
    }
    ctx.restore();

    for (const ship of state.ships) {
      if (!ship.alive) continue;
      const pos = shipPosition(ship, simTime, state.running);
      const flashed = state.effects.some((effect) => {
        return effect.targetId === ship.id && simTime - effect.t < 0.22;
      });
      const sinking = state.running && hpTextFor(ship) <= 0;
      ctx.save();
      if (sinking) ctx.globalAlpha = 0.45;
      drawShip(
        ctx,
        view,
        ship,
        pos.x,
        pos.y,
        hpTextFor(ship).toFixed(1),
        flashed,
        pos.y < -80
      );
      ctx.restore();
    }
  }

  root.VectorFleetDraw = { drawFrame };
})(typeof globalThis !== "undefined" ? globalThis : window);
