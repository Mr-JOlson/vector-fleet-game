(function (root) {
  let audioCtx = null;
  let muted = false;

  try {
    muted = localStorage.getItem("vector-fleet-mute") === "1";
  } catch (err) {
    muted = false;
  }

  function ensureAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function setMuted(next) {
    muted = next;
    try {
      localStorage.setItem("vector-fleet-mute", muted ? "1" : "0");
    } catch (err) {
      /* Private browsing can block storage. The button still works for this visit. */
    }
  }

  function isMuted() {
    return muted;
  }

  function playExplosion() {
    const ctx = ensureAudio();
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const duration = 0.42;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const env = (1 - i / frames) ** 2;
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.exponentialRampToValueAtTime(140, t + duration);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t);

    const boom = ctx.createOscillator();
    boom.type = "sine";
    boom.frequency.setValueAtTime(150, t);
    boom.frequency.exponentialRampToValueAtTime(42, t + 0.38);
    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(0.22, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    boom.connect(boomGain);
    boomGain.connect(ctx.destination);
    boom.start(t);
    boom.stop(t + 0.4);
  }

  root.VectorFleetAudio = {
    ensureAudio,
    setMuted,
    isMuted,
    playExplosion
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
