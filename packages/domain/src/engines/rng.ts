export interface RngState {
  readonly seed: number;
}

export interface Rng {
  next(): number;
  nextInt(min: number, max: number): number;
  nextFloat(): number;
}

export function createRng(seed: number): Rng {
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
  };
}
