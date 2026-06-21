export type PresetId =
    | "vocal"
    | "bass"
    | "acoustic-guitar"
    | "electric-guitar-forro"
    | "percussion";

export interface CompositeChange {
    target: string;
    action: string;
    value: unknown;
    applied?: boolean;
}

export interface ChannelPreset {
    id: PresetId;
    description: string;
    hpf: { on: boolean; frequencyHz: number };
    eq: {
        on: boolean;
        bands: Array<{
            band: 1 | 2 | 3 | 4;
            gain: number;
            frequency?: number;
            q?: number;
        }>;
    };
    compressor?: {
        on: boolean;
        threshold: number;
        ratio: number;
        attack?: number;
        release?: number;
    };
    gate?: { on: boolean; threshold: number };
    fxSend?: { effect: 1 | 2 | 3 | 4; levelDb: number };
}

export const PRESETS: Record<PresetId, ChannelPreset> = {
    vocal: {
        id: "vocal",
        description: "Lead vocal: HPF, mud cut, presence boost, light comp, reverb send",
        hpf: { on: true, frequencyHz: 100 },
        eq: {
            on: true,
            bands: [
                { band: 2, gain: -3, frequency: 250, q: 1.5 },
                { band: 3, gain: 3, frequency: 3000, q: 2 },
            ],
        },
        compressor: { on: true, threshold: -18, ratio: 3 },
        fxSend: { effect: 1, levelDb: -18 },
    },
    bass: {
        id: "bass",
        description: "Bass: low HPF, low boost, mid cut, medium comp",
        hpf: { on: true, frequencyHz: 40 },
        eq: {
            on: true,
            bands: [
                { band: 1, gain: 2, frequency: 80, q: 1 },
                { band: 2, gain: -2, frequency: 400, q: 1.5 },
            ],
        },
        compressor: { on: true, threshold: -12, ratio: 4 },
    },
    "acoustic-guitar": {
        id: "acoustic-guitar",
        description: "Acoustic guitar: HPF, mud cut, air boost, light comp, subtle reverb",
        hpf: { on: true, frequencyHz: 80 },
        eq: {
            on: true,
            bands: [
                { band: 2, gain: -2, frequency: 200, q: 1.5 },
                { band: 4, gain: 2, frequency: 8000, q: 1 },
            ],
        },
        compressor: { on: true, threshold: -20, ratio: 2 },
        fxSend: { effect: 1, levelDb: -24 },
    },
    "electric-guitar-forro": {
        id: "electric-guitar-forro",
        description:
            "Forró rhythm electric guitar: tight HPF, low-mid cut for accordion space, pick bite, punchy comp, dry",
        hpf: { on: true, frequencyHz: 110 },
        eq: {
            on: true,
            bands: [
                { band: 2, gain: -3, frequency: 350, q: 1.5 },
                { band: 3, gain: 3, frequency: 2800, q: 2 },
            ],
        },
        compressor: { on: true, threshold: -14, ratio: 4 },
    },
    percussion: {
        id: "percussion",
        description: "Percussion: HPF, click boost, mud cut, punchy comp",
        hpf: { on: true, frequencyHz: 80 },
        eq: {
            on: true,
            bands: [
                { band: 2, gain: -2, frequency: 400, q: 1.5 },
                { band: 3, gain: 3, frequency: 3000, q: 2 },
            ],
        },
        compressor: { on: true, threshold: -15, ratio: 4 },
    },
};

export function listPresetIds(): PresetId[] {
    return Object.keys(PRESETS) as PresetId[];
}

export function getPreset(id: string): ChannelPreset {
    const preset = PRESETS[id as PresetId];
    if (!preset) {
        throw new Error(
            `Unknown preset "${id}". Available: ${listPresetIds().join(", ")}`
        );
    }
    return preset;
}

function chTarget(channel: number, path: string): string {
    return `ch${String(channel).padStart(2, "0")}.${path}`;
}

export function buildPresetChanges(
    channel: number,
    preset: ChannelPreset
): CompositeChange[] {
    const changes: CompositeChange[] = [];

    changes.push({
        target: chTarget(channel, "hpf.on"),
        action: "set",
        value: preset.hpf.on,
    });
    changes.push({
        target: chTarget(channel, "hpf.hz"),
        action: "set",
        value: preset.hpf.frequencyHz,
    });

    changes.push({
        target: chTarget(channel, "eq.on"),
        action: "set",
        value: preset.eq.on,
    });
    for (const band of preset.eq.bands) {
        changes.push({
            target: chTarget(channel, `eq.band${band.band}.gain`),
            action: "set",
            value: band.gain,
        });
        if (band.frequency !== undefined) {
            changes.push({
                target: chTarget(channel, `eq.band${band.band}.frequency`),
                action: "set",
                value: band.frequency,
            });
        }
        if (band.q !== undefined) {
            changes.push({
                target: chTarget(channel, `eq.band${band.band}.q`),
                action: "set",
                value: band.q,
            });
        }
    }

    if (preset.gate) {
        changes.push({
            target: chTarget(channel, "gate.on"),
            action: "set",
            value: preset.gate.on,
        });
        changes.push({
            target: chTarget(channel, "gate.threshold"),
            action: "set",
            value: preset.gate.threshold,
        });
    }

    if (preset.compressor) {
        changes.push({
            target: chTarget(channel, "compressor.on"),
            action: "set",
            value: preset.compressor.on,
        });
        changes.push({
            target: chTarget(channel, "compressor.threshold"),
            action: "set",
            value: preset.compressor.threshold,
        });
        changes.push({
            target: chTarget(channel, "compressor.ratio"),
            action: "set",
            value: preset.compressor.ratio,
        });
        if (preset.compressor.attack !== undefined) {
            changes.push({
                target: chTarget(channel, "compressor.attack"),
                action: "set",
                value: preset.compressor.attack,
            });
        }
        if (preset.compressor.release !== undefined) {
            changes.push({
                target: chTarget(channel, "compressor.release"),
                action: "set",
                value: preset.compressor.release,
            });
        }
    }

    if (preset.fxSend) {
        changes.push({
            target: chTarget(channel, `fx${preset.fxSend.effect}.send`),
            action: "set",
            value: { levelDb: preset.fxSend.levelDb },
        });
    }

    return changes;
}
