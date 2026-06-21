import {
    labelMeterValues,
    parseMeterBlob,
    summarizeChannelLevels,
} from "./meter-parser.js";

export type MeterGroup = "input" | "mix";

export interface MeterCacheEntry {
    valuesDb: number[];
    labeled: Record<string, number>;
    updatedAt: Date;
}

export interface MeterSnapshot {
    updatedAt: string | null;
    source: "cache" | "snapshot";
    input?: Record<string, number>;
    mix?: Record<string, number>;
    hotChannels: number[];
    silentChannels: number[];
}

const METER_PATHS = ["1", "2"] as const;
const RENEW_INTERVAL_MS = 8000;
const SNAPSHOT_WAIT_MS = 500;
const CACHE_FRESH_MS = 100;

export class MeterSubscription {
    private host: string;
    private port: number;
    private sendFn: (address: string, args?: any[]) => void;
    private cache: Map<string, MeterCacheEntry> = new Map();
    private renewTimer: ReturnType<typeof setInterval> | null = null;
    private pendingSnapshots: Map<
        string,
        { resolve: (entry: MeterCacheEntry) => void; timer: ReturnType<typeof setTimeout> }
    > = new Map();

    constructor(
        host: string,
        port: number,
        sendFn: (address: string, args?: any[]) => void
    ) {
        this.host = host;
        this.port = port;
        this.sendFn = sendFn;
    }

    start(): void {
        for (const id of METER_PATHS) {
            this.subscribe(id);
        }
        this.renewTimer = setInterval(() => {
            for (const id of METER_PATHS) {
                this.renew(id);
            }
        }, RENEW_INTERVAL_MS);
    }

    stop(): void {
        if (this.renewTimer) {
            clearInterval(this.renewTimer);
            this.renewTimer = null;
        }
        for (const [, pending] of this.pendingSnapshots) {
            clearTimeout(pending.timer);
        }
        this.pendingSnapshots.clear();
    }

    private subscribe(meterId: string): void {
        const path = `/meters/${meterId}`;
        const shortPath = `meters/${meterId}`;
        this.sendFn("/batchsubscribe", [shortPath, path, 0, 0, 1]);
    }

    private renew(meterId: string): void {
        this.sendFn("/renew", [`/meters/${meterId}`]);
    }

    handleRawPacket(buf: Buffer): void {
        if (buf.length < 6) return;
        const prefix = buf.subarray(0, 7).toString("ascii");
        if (prefix !== "meters/" && !buf.includes(Buffer.from("meters/"))) {
            return;
        }

        const parsed = parseMeterBlob(buf);
        if (!parsed || parsed.valuesDb.length === 0) return;

        const meterKey = parsed.meterId as "1" | "2";
        if (meterKey !== "1" && meterKey !== "2") return;

        const entry: MeterCacheEntry = {
            valuesDb: parsed.valuesDb,
            labeled: labelMeterValues(meterKey, parsed.valuesDb),
            updatedAt: new Date(),
        };
        this.cache.set(meterKey, entry);

        const pending = this.pendingSnapshots.get(meterKey);
        if (pending) {
            clearTimeout(pending.timer);
            this.pendingSnapshots.delete(meterKey);
            pending.resolve(entry);
        }
    }

    getCache(groups: MeterGroup[]): MeterSnapshot {
        const input = groups.includes("input")
            ? this.cache.get("2")?.labeled
            : undefined;
        const mix = groups.includes("mix") ? this.cache.get("1")?.labeled : undefined;

        const latest = [...this.cache.values()].sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        )[0];

        const { hotChannels, silentChannels } = summarizeChannelLevels(
            input ?? {},
            mix ?? {}
        );

        return {
            updatedAt: latest ? latest.updatedAt.toISOString() : null,
            source: "cache",
            input,
            mix,
            hotChannels,
            silentChannels,
        };
    }

    async getSnapshot(groups: MeterGroup[]): Promise<MeterSnapshot> {
        const freshEnough = [...groups.map((g) => (g === "input" ? "2" : "1"))].every(
            (id) => {
                const entry = this.cache.get(id);
                return (
                    entry &&
                    Date.now() - entry.updatedAt.getTime() < CACHE_FRESH_MS
                );
            }
        );

        if (freshEnough) {
            const cached = this.getCache(groups);
            return { ...cached, source: "cache" };
        }

        const waitIds = new Set<string>();
        if (groups.includes("input")) waitIds.add("2");
        if (groups.includes("mix")) waitIds.add("1");

        const waits = [...waitIds].map(
            (id) =>
                new Promise<MeterCacheEntry>((resolve, reject) => {
                    const timer = setTimeout(() => {
                        this.pendingSnapshots.delete(id);
                        const existing = this.cache.get(id);
                        if (existing) resolve(existing);
                        else reject(new Error(`Timeout waiting for /meters/${id}`));
                    }, SNAPSHOT_WAIT_MS);
                    this.pendingSnapshots.set(id, { resolve, timer });
                    this.subscribe(id);
                    this.renew(id);
                })
        );

        try {
            await Promise.all(waits);
        } catch {
            // Return best-effort cache
        }

        const snapshot = this.getCache(groups);
        return { ...snapshot, source: "snapshot" };
    }
}
