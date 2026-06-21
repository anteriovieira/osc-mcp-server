/**
 * X-Air / X32 dynamics ratio: OSC integer index 0–11 (/ch/XX/dyn/ratio ,i).
 * Display ratios from X-Air Edit / xair-api.
 */
export const COMPRESSOR_RATIO_INDEX_MAX = 11;

/** Display ratio for each index 0–10; index 11 = ∞:1 */
export const COMPRESSOR_RATIOS: readonly number[] = [
    1.1, 1.3, 1.5, 2, 2.5, 3, 4, 5, 7, 10, 20,
];

/** Nearest table index for a display ratio (e.g. 1.3 → 1, 3 → 5). */
export function ratioToIndex(ratio: number): number {
    if (!Number.isFinite(ratio) || ratio >= 50) {
        return COMPRESSOR_RATIO_INDEX_MAX;
    }

    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < COMPRESSOR_RATIOS.length; i++) {
        const dist = Math.abs(COMPRESSOR_RATIOS[i]! - ratio);
        if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
        }
    }
    return bestIndex;
}

/** Display ratio for an OSC index (11 → 100 as ∞ stand-in for JSON tools). */
export function indexToRatio(index: number): number {
    const i = Math.max(
        0,
        Math.min(COMPRESSOR_RATIO_INDEX_MAX, Math.round(index))
    );
    if (i === COMPRESSOR_RATIO_INDEX_MAX) return 100;
    return COMPRESSOR_RATIOS[i]!;
}

/** Decode mixer response (integer index or legacy normalized float). */
export function parseRatioOscValue(raw: unknown): number {
    const v = Number(raw);
    if (!Number.isFinite(v)) return COMPRESSOR_RATIOS[0]!;

    if (v >= 0 && v <= COMPRESSOR_RATIO_INDEX_MAX && Math.abs(v - Math.round(v)) < 0.001) {
        return indexToRatio(Math.round(v));
    }

    if (v >= 0 && v <= 1) {
        return indexToRatio(Math.round(v * COMPRESSOR_RATIO_INDEX_MAX));
    }

    return indexToRatio(Math.round(v));
}
