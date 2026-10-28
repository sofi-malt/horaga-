// Web Audio API sound synthesizer for order notifications (no external MP3 files needed)

export function playChime(type = 'new_order') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'new_order') {
      // Pleasant double ping (high bell)
      const now = ctx.currentTime;
      [
        { freq: 880, start: now, dur: 0.18 },
        { freq: 1174.66, start: now + 0.18, dur: 0.35 },
      ].forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      });
    } else if (type === 'confirmed') {
      // Ascending chord: C - E - G (major triad)
      const now = ctx.currentTime;
      [
        { freq: 523.25, start: now, dur: 0.15 },
        { freq: 659.25, start: now + 0.12, dur: 0.15 },
        { freq: 783.99, start: now + 0.24, dur: 0.35 },
      ].forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      });
    } else if (type === 'ready') {
      // Triple ding for Kitchen ready
      const now = ctx.currentTime;
      [
        { freq: 1046.5, start: now, dur: 0.12 },
        { freq: 1318.51, start: now + 0.15, dur: 0.12 },
        { freq: 1567.98, start: now + 0.3, dur: 0.4 },
      ].forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      });
    } else if (type === 'alert') {
      // Warning sound
      const now = ctx.currentTime;
      [
        { freq: 440, start: now, dur: 0.15 },
        { freq: 350, start: now + 0.16, dur: 0.25 },
      ].forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      });
    }
  } catch (e) {
    // Audio autostart may require user interaction
  }
}
