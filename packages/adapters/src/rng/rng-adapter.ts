import type { RngPort } from '@creature-chronicles/ports';

export function createRngAdapter(initialSeed?: number): RngPort {
  let seed = initialSeed ?? Date.now();
  let s = seed;

  function xorshift32(): number {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    s = s >>> 0;
    return s;
  }

  return {
    next(): number {
      return xorshift32() / 0xffffffff;
    },
    nextInt(min: number, max: number): number {
      return min + Math.floor((xorshift32() / 0xffffffff) * (max - min + 1));
    },
    nextFloat(): number {
      return xorshift32() / 0xffffffff;
    },
    getSeed(): number {
      return seed;
    },
    setSeed(newSeed: number): void {
      seed = newSeed;
      s = newSeed;
    },
  };
}
