export interface RngPort {
  next(): number;
  nextInt(min: number, max: number): number;
  nextFloat(): number;
  getSeed(): number;
  setSeed(seed: number): void;
}
