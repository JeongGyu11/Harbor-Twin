const PREF_KEY = 'harbor-twin.ocean-audio.v1';
export function readAudioPreference(storage) {
  try {
    const p = JSON.parse(storage.getItem(PREF_KEY));
    if (p && typeof p.enabled === 'boolean' && typeof p.volume === 'number' && Number.isFinite(p.volume))
      return {enabled: p.enabled, volume: Math.min(1, Math.max(0, p.volume))};
  } catch {}
  return {enabled: true, volume: .18};
}

// Procedural ambience: no remote audio, tracking, or third-party recordings.
export function createOceanAudio(Context, {random = Math.random, schedule = setTimeout, cancel = clearTimeout} = {}) {
  let ctx, master, gullTimer, suspendTimer, epoch = 0, volume = .18, disposed = false;
  const birds = new Set();
  function build() {
    ctx = new Context();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 12, ctx.sampleRate);
    const data = noise.getChannelData(0); let brown = 0;
    for (let i = 0; i < data.length; i++) {
      brown = (brown + (random() * 2 - 1) * .035) / 1.035;
      const edge = Math.min(1, i / (ctx.sampleRate * .06), (data.length - 1 - i) / (ctx.sampleRate * .06));
      data[i] = brown * 4 * edge;
    }
    const sea = ctx.createBufferSource(); sea.buffer = noise; sea.loop = true;
    const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 700;
    const rumble = ctx.createBiquadFilter(); rumble.type = 'highpass'; rumble.frequency.value = 65;
    const swell = ctx.createGain(); swell.gain.value = .55;
    const tide = ctx.createOscillator(); tide.frequency.value = .085;
    const depth = ctx.createGain(); depth.gain.value = .33;
    tide.connect(depth).connect(swell.gain);
    sea.connect(low).connect(rumble).connect(swell).connect(master);
    // Softer high-frequency foam, on a different swell period.
    const foam = ctx.createBiquadFilter(); foam.type = 'highpass'; foam.frequency.value = 1500;
    const foamGain = ctx.createGain(); foamGain.gain.value = .035;
    const wash = ctx.createOscillator(); wash.frequency.value = .067;
    const washDepth = ctx.createGain(); washDepth.gain.value = .025;
    wash.connect(washDepth).connect(foamGain.gain);
    sea.connect(foam).connect(foamGain).connect(master);
    sea.start(); tide.start(); wash.start();
  }
  function callGull(start) {
    const duration = .55 + random() * .28;
    const voice = ctx.createOscillator(); voice.type = 'triangle';
    const pitch = 1050 + random() * 200;
    voice.frequency.setValueAtTime(pitch * .78, start);
    voice.frequency.exponentialRampToValueAtTime(pitch * 1.22, start + .09);
    voice.frequency.exponentialRampToValueAtTime(pitch * .58, start + duration);
    const tremolo = ctx.createOscillator(); tremolo.frequency.value = 25 + random() * 8;
    const vibrato = ctx.createGain(); vibrato.gain.value = 22;
    tremolo.connect(vibrato).connect(voice.frequency);
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2400;
    const envelope = ctx.createGain(); envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(.055, start + .06);
    envelope.gain.exponentialRampToValueAtTime(.001, start + duration);
    const pan = ctx.createStereoPanner(); pan.pan.value = random() * 1.2 - .6;
    voice.connect(tone).connect(envelope).connect(pan).connect(master);
    const pair = [voice, tremolo]; birds.add(pair);
    voice.onended = () => { birds.delete(pair); for (const n of [voice, tremolo, tone, envelope, pan, vibrato]) n.disconnect(); };
    voice.start(start); tremolo.start(start); voice.stop(start + duration + .03); tremolo.stop(start + duration + .03);
  }
  function nextGull(delay) {
    cancel(gullTimer);
    gullTimer = schedule(() => {
      if (disposed || ctx.state !== 'running') return;
      const start = ctx.currentTime + .06;
      const count = random() < .65 ? 2 : 3;
      for (let i = 0; i < count; i++) callGull(start + i * .85);
      nextGull(22000 + random() * 22000);
    }, delay);
  }
  return {
    get state() { return ctx?.state ?? 'waiting'; },
    async start() {
      if (disposed) return false;
      const mine = ++epoch; cancel(suspendTimer);
      if (!ctx) build();
      await ctx.resume();
      if (disposed || mine !== epoch || ctx.state !== 'running') return false;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(volume, ctx.currentTime, .35);
      nextGull(7000 + random() * 5000);
      return true;
    },
    setVolume(value) {
      volume = Math.min(1, Math.max(0, Number.isFinite(value) ? value : .18));
      if (ctx?.state === 'running') master.gain.setTargetAtTime(volume, ctx.currentTime, .08);
    },
    pause() {
      ++epoch; cancel(gullTimer); cancel(suspendTimer);
      for (const pair of birds) for (const node of pair) { try { node.stop(); } catch {} }
      birds.clear();
      if (!ctx) return;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, .025);
      suspendTimer = schedule(() => { if (ctx.state === 'running') ctx.suspend().catch(() => {}); }, 100);
    },
    dispose() {
      disposed = true; ++epoch; cancel(gullTimer); cancel(suspendTimer);
      if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
    }
  };
}

function initOceanAudio() {
  const host = document.querySelector('.header-right'); if (!host) return;
  let storage; try { storage = localStorage; } catch {}
  let {enabled, volume} = readAudioPreference(storage);
  const Context = window.AudioContext || window.webkitAudioContext;
  let supported = !!Context, playing = false, attempt = 0;
  const audio = supported ? createOceanAudio(Context) : null;
  const style = document.createElement('style');
  style.textContent = `
    .ocean-audio{display:flex;align-items:center;gap:12px;font:inherit;font-size:12px;color:#a8c4ce}
    .ocean-audio button{display:flex;align-items:center;gap:8px;border:1px solid #315361;border-radius:9px;background:#112a36;color:#d7f5ee;padding:7px 11px;min-height:38px;cursor:pointer;font:inherit}
    .ocean-audio button[aria-pressed=true]{border-color:#49a899}
    .ocean-audio button:focus-visible,.ocean-audio input:focus-visible{outline:2px solid #6ff0d2;outline-offset:3px}
    .ocean-audio small{display:block;font-size:10px;color:#9fb9c4;line-height:1.4}
    .ocean-audio label{display:flex;align-items:center;gap:6px;font-size:11px}
    .ocean-audio input{width:70px;accent-color:#63ddc4;cursor:pointer}
    @media(max-width:620px){.app header{height:auto;min-height:62px;padding:10px 15px;gap:10px;flex-wrap:wrap}.header-right{gap:8px}.ocean-audio{gap:7px}.ocean-audio button{padding:5px 8px}.ocean-audio input{width:52px}.ocean-audio label span{display:none}}
  `;
  document.head.append(style);
  const root = document.createElement('div'); root.className = 'ocean-audio'; root.id = 'ocean-audio';
  root.innerHTML = `<button id="ocean-audio-toggle" type="button" aria-pressed="true"><span class="ocean-audio-icon" aria-hidden="true">♫</span><span>바다 소리<small id="ocean-audio-status" role="status" aria-live="polite"></small></span></button><label><span>음량</span><input id="ocean-audio-volume" type="range" min="0" max="100" step="1" aria-label="바다 소리 음량"></label>`;
  host.prepend(root);
  const button = root.querySelector('button'), status = root.querySelector('small'), slider = root.querySelector('input');
  slider.value = Math.round(volume * 100); audio?.setVolume(volume);
  const save = () => { try { storage?.setItem(PREF_KEY, JSON.stringify({enabled, volume})); } catch {} };
  function render() {
    button.disabled = !supported; slider.disabled = !supported;
    button.setAttribute('aria-pressed', String(supported && enabled));
    button.setAttribute('aria-label', enabled ? '바다 소리 끄기' : '바다 소리 켜기');
    button.title = '분위기용 파도·갈매기 환경음 · 실제 날씨·경보와 무관';
    status.textContent = !supported ? '이 브라우저는 소리를 지원하지 않아요' : !enabled ? '소리 꺼짐' : document.hidden ? '탭을 벗어나 일시정지' : playing ? `재생 중 · ${Math.round(volume * 100)}%` : '첫 클릭으로 재생';
    root.dataset.audioState = !supported ? 'unavailable' : !enabled ? 'off' : document.hidden ? 'paused' : playing ? 'playing' : 'waiting';
  }
  async function start() {
    if (!supported || !enabled || document.hidden || (playing && audio.state === 'running')) return;
    const mine = ++attempt;
    try { const ok = await audio.start(); if (mine === attempt) { playing = ok; render(); } }
    catch (error) {
      if (mine !== attempt) return;
      playing = false;
      if (error.name !== 'NotAllowedError') supported = false;
      render();
    }
  }
  const pause = () => { ++attempt; playing = false; audio?.pause(); render(); };
  button.addEventListener('click', () => { enabled = !enabled; save(); if (enabled) { render(); start(); } else pause(); });
  slider.addEventListener('input', () => { volume = Number(slider.value) / 100; audio?.setVolume(volume); save(); render(); });
  const gesture = () => { if (enabled && audio?.state !== 'running') start(); };
  document.addEventListener('pointerdown', gesture, {capture: true, passive: true});
  document.addEventListener('keydown', gesture, {capture: true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else { render(); start(); } });
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', () => { render(); start(); });
  render(); start();
}
if (typeof document !== 'undefined') initOceanAudio();
