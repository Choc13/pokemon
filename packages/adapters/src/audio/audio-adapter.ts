import type { AudioPort } from '@creature-chronicles/ports';

export function createAudioAdapter(): AudioPort {
  let audioContext: AudioContext | null = null;
  let currentMusic: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  let musicVolume = 0.7;
  let sfxVolume = 0.8;

  function getContext(): AudioContext {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    return audioContext;
  }

  return {
    async playMusic(trackId: string, loop = true): Promise<void> {
      // Stop current music
      if (currentMusic) {
        currentMusic.source.stop();
        currentMusic = null;
      }

      try {
        const ctx = getContext();
        const response = await fetch(`/assets/audio/${trackId}.mp3`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = loop;

        const gain = ctx.createGain();
        gain.gain.value = musicVolume;

        source.connect(gain);
        gain.connect(ctx.destination);
        source.start();

        currentMusic = { source, gain };
      } catch {
        // Audio loading failed — silent fallback
      }
    },

    async stopMusic(fadeOut = true): Promise<void> {
      if (!currentMusic) return;

      if (fadeOut) {
        const ctx = getContext();
        currentMusic.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
        const music = currentMusic;
        setTimeout(() => {
          try { music.source.stop(); } catch { /* already stopped */ }
        }, 1000);
      } else {
        currentMusic.source.stop();
      }
      currentMusic = null;
    },

    playSFX(sfxId: string): void {
      try {
        const ctx = getContext();
        fetch(`/assets/audio/${sfxId}.mp3`)
          .then((r) => r.arrayBuffer())
          .then((buf) => ctx.decodeAudioData(buf))
          .then((audioBuffer) => {
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            const gain = ctx.createGain();
            gain.gain.value = sfxVolume;
            source.connect(gain);
            gain.connect(ctx.destination);
            source.start();
          })
          .catch(() => { /* silent fallback */ });
      } catch { /* silent fallback */ }
    },

    setMusicVolume(volume: number): void {
      musicVolume = Math.max(0, Math.min(1, volume));
      if (currentMusic) {
        currentMusic.gain.gain.value = musicVolume;
      }
    },

    setSFXVolume(volume: number): void {
      sfxVolume = Math.max(0, Math.min(1, volume));
    },
  };
}
