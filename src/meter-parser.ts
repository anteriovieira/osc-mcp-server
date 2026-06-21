/**
 * X-Air meter blob parsing.
 *
 * Push format (from XR18):
 *   meters/N + null padding to 4 bytes
 *   ,b + null padding (OSC blob type tag)
 *   i32 BE blob byte size (includes count field)
 *   i32 LE value count
 *   count × i16 LE meter samples (dB = raw / 256)
 */

export const METER_HOT_DB = -6;
export const METER_SILENT_DB = -60;

export const METER_VALUE_COUNTS: Record<string, number> = {
    "1": 40,
    "2": 36,
};

/** Labels for /meters/1 — 40 channel/bus/main mix meters */
export const METERS_1_LABELS: string[] = [
    ...Array.from({ length: 16 }, (_, i) => `ch${String(i + 1).padStart(2, "0")}`),
    "fxRetL",
    "fxRetR",
    "aux3L",
    "aux3R",
    "aux4L",
    "aux4R",
    "aux5L",
    "aux5R",
    "aux6L",
    "aux6R",
    "bus01",
    "bus02",
    "bus03",
    "bus04",
    "bus05",
    "bus06",
    "fxSend01",
    "fxSend02",
    "fxSend03",
    "fxSend04",
    "mainL",
    "mainR",
    "monL",
    "monR",
];

/** Labels for /meters/2 — 36 input/preamp meters */
export const METERS_2_LABELS: string[] = [
    ...Array.from({ length: 16 }, (_, i) => `input${String(i + 1).padStart(2, "0")}`),
    "aux1",
    "aux2",
    ...Array.from({ length: 18 }, (_, i) => `usb${String(i + 1).padStart(2, "0")}`),
];

export function rawToDb(raw: number): number {
    return raw / 256;
}

function pad4(offset: number): number {
    return offset + ((4 - (offset % 4)) % 4);
}

function readMeterId(buf: Buffer): { meterId: string; offset: number } | null {
    if (buf.length < 8 || buf.subarray(0, 7).toString("ascii") !== "meters/") {
        return null;
    }

    const end = buf.indexOf(0, 7);
    const meterId =
        end >= 0
            ? buf.subarray(7, end).toString("ascii")
            : buf.subarray(7, 8).toString("ascii");

    if (meterId !== "1" && meterId !== "2") return null;

    return { meterId, offset: pad4(end >= 0 ? end + 1 : 8) };
}

function decodeOscBlobMeters(
    buf: Buffer,
    offset: number,
    meterId: string
): number[] | null {
    if (offset + 8 > buf.length) return null;
    if (buf[offset] !== 0x2c || buf[offset + 1] !== 0x62) return null;

    const blobStart = pad4(offset + 2);
    if (blobStart + 8 > buf.length) return null;

    const blobSize = buf.readInt32BE(blobStart);
    const count = buf.readInt32LE(blobStart + 4);
    const valuesStart = blobStart + 8;
    const expected = METER_VALUE_COUNTS[meterId];

    if (count !== expected) return null;
    if (blobSize !== 4 + count * 2) return null;
    if (valuesStart + count * 2 > buf.length) return null;

    const values: number[] = [];
    for (let i = 0; i < count; i++) {
        values.push(rawToDb(buf.readInt16LE(valuesStart + i * 2)));
    }
    return values;
}

/**
 * Decode meter values from a raw UDP packet (X-Air push format).
 */
export function parseMeterBlob(data: Buffer | Uint8Array): {
    meterId: string;
    valuesDb: number[];
} | null {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (buf.length < 24) return null;

    const header = readMeterId(buf);
    if (!header) return null;

    const valuesDb = decodeOscBlobMeters(buf, header.offset, header.meterId);
    if (!valuesDb) return null;

    return { meterId: header.meterId, valuesDb };
}

export function labelMeterValues(
    meterKey: "1" | "2",
    valuesDb: number[]
): Record<string, number> {
    const labels = meterKey === "1" ? METERS_1_LABELS : METERS_2_LABELS;
    const result: Record<string, number> = {};
    for (let i = 0; i < valuesDb.length; i++) {
        const label = labels[i] ?? `idx${i}`;
        result[label] = Math.round(valuesDb[i] * 10) / 10;
    }
    return result;
}

export function summarizeChannelLevels(
    input: Record<string, number>,
    mix: Record<string, number>,
    hotDb = METER_HOT_DB,
    silentDb = METER_SILENT_DB
): { hotChannels: number[]; silentChannels: number[] } {
    const hotChannels: number[] = [];
    const silentChannels: number[] = [];

    for (let ch = 1; ch <= 16; ch++) {
        const key = `ch${String(ch).padStart(2, "0")}`;
        const inputKey = `input${String(ch).padStart(2, "0")}`;
        const mixDb = mix[key];
        const inputDb = input[inputKey];
        const level = mixDb ?? inputDb;
        if (level === undefined) continue;
        if (level > hotDb) hotChannels.push(ch);
        if (level < silentDb) silentChannels.push(ch);
    }

    return { hotChannels, silentChannels };
}

/** Build a fixture packet matching live XR18 format (for tests). */
export function buildMeterPacket(meterId: "1" | "2", rawValues: number[]): Buffer {
    const count = rawValues.length;
    const blobSize = 4 + count * 2;
    const idBytes = Buffer.from(`meters/${meterId}`, "ascii");
    const idPadded = pad4(idBytes.length + 1);
    const header = Buffer.alloc(idPadded, 0);
    idBytes.copy(header);
    const tag = Buffer.from(",b\0\0");
    const blobHeader = Buffer.alloc(8);
    blobHeader.writeInt32BE(blobSize, 0);
    blobHeader.writeInt32LE(count, 4);
    const values = Buffer.alloc(count * 2);
    for (let i = 0; i < count; i++) {
        values.writeInt16LE(rawValues[i]!, i * 2);
    }
    return Buffer.concat([header, tag, blobHeader, values]);
}
