/**
 * Intervalo semiaberto [start, end) em milissegundos UTC.
 * Mesma semântica do tstzrange '[)' usado na exclusion constraint do banco.
 */
export interface Interval {
  start: number;
  end: number;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Remove de `free` todos os trechos ocupados por `busy`. */
export function subtractIntervals(free: Interval[], busy: Interval[]): Interval[] {
  let result = free;
  for (const b of busy) {
    result = result.flatMap((f) => {
      if (!overlaps(f, b)) return [f];
      const parts: Interval[] = [];
      if (f.start < b.start) parts.push({ start: f.start, end: b.start });
      if (b.end < f.end) parts.push({ start: b.end, end: f.end });
      return parts;
    });
  }
  return result;
}

/** Gera inícios de slot de `durationMs` a cada `stepMs` que cabem nos intervalos livres. */
export function generateSlots(free: Interval[], durationMs: number, stepMs: number): number[] {
  const slots: number[] = [];
  for (const f of free) {
    for (let t = f.start; t + durationMs <= f.end; t += stepMs) slots.push(t);
  }
  return slots;
}
