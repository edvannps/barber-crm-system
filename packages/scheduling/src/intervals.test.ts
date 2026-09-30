import { describe, expect, it } from 'vitest';
import { generateSlots, overlaps, subtractIntervals } from './intervals.js';

const MIN = 60_000;

describe('overlaps', () => {
  it('intervalos que apenas se encostam não se sobrepõem', () => {
    expect(overlaps({ start: 0, end: 30 * MIN }, { start: 30 * MIN, end: 60 * MIN })).toBe(false);
  });
});

describe('generateSlots', () => {
  it('remove horário ocupado e gera slots que cabem', () => {
    const free = subtractIntervals(
      [{ start: 0, end: 120 * MIN }],
      [{ start: 30 * MIN, end: 60 * MIN }],
    );
    expect(generateSlots(free, 30 * MIN, 15 * MIN)).toEqual([0, 60 * MIN, 75 * MIN, 90 * MIN]);
  });
});
