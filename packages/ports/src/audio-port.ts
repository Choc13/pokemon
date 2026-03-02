export interface AudioPort {
  playMusic(trackId: string, loop?: boolean): Promise<void>;
  stopMusic(fadeOut?: boolean): Promise<void>;
  playSFX(sfxId: string): void;
  setMusicVolume(volume: number): void;
  setSFXVolume(volume: number): void;
}
