import OSC from "osc-js";
import { MeterSubscription, MeterGroup, MeterSnapshot } from "./meter-subscription.js";
import {
    fetchChannelNameIndex,
    resolveChannelRef,
    resolveChannelRefs,
} from "./channel-resolve.js";
import {
    buildPresetChanges,
    getPreset,
    type CompositeChange,
} from "./presets.js";
import { METER_HOT_DB, METER_SILENT_DB } from "./meter-parser.js";
import {
    parseRatioOscValue,
    ratioToIndex,
} from "./compressor-ratio.js";

export interface ChannelOverview {
    ch: number;
    name: string;
    fader: number;
    faderDb: number;
    muted: boolean;
    pan: string;
    panValue: number;
    source: number;
    hpfHz: number;
    hpfOn?: boolean;
    sends?: Record<string, number>;
    dynamics?: ChannelDynamicsSummary;
}

export interface BusOverview {
    bus: number;
    name: string;
    fader: number;
    faderDb: number;
    muted: boolean;
}

export interface ChannelDynamicsSummary {
    eqOn: boolean;
    eq: Array<{ band: number; gain: number; frequency: number; q: number }>;
    gateOn: boolean;
    gateThreshold: number;
    compressorOn: boolean;
    compressor: { threshold: number; ratio: number };
}

export interface MixerOverview {
    scene: { index: number; name: string };
    main: { fader: number; faderDb: number; muted: boolean };
    channels?: ChannelOverview[];
    buses?: BusOverview[];
}

export interface ChannelDetail {
    ch: number;
    name: string;
    source: number;
    fader: number;
    faderDb: number;
    muted: boolean;
    pan: string;
    panValue: number;
    hpf: { on: boolean; hz: number };
    eq: { on: boolean; bands: Array<{ band: number; gain: number; frequency: number; q: number }> };
    gate: { on: boolean; threshold: number };
    compressor: { on: boolean; threshold: number; ratio: number };
    sendsToBus: Record<string, { level: number; levelDb: number }>;
    sendsToFx: Record<string, { level: number; levelDb: number }>;
}

interface PendingOscRequest {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    args?: any[];
}

export class OSCClient {
    private osc: any;
    private plugin: any;
    private host: string;
    private port: number;
    private pendingRequests: Map<string, PendingOscRequest[]> = new Map();
    private isConnected: boolean = false;
    private xremoteTimer: ReturnType<typeof setInterval> | null = null;
    private meterSubscription: MeterSubscription | null = null;

    constructor(host: string, port: number) {
        this.host = host;
        this.port = port;

        // Create OSC instance with UDP plugin
        this.plugin = new (OSC as any).DatagramPlugin({
            open: {
                host: "0.0.0.0",
                port: 0,
            },
            send: {
                host: this.host,
                port: this.port,
            },
        });

        this.osc = new (OSC as any)({
            plugin: this.plugin,
        });

        // Handle incoming OSC messages
        this.osc.on("*", (message: any) => {
            const address = message.address;
            if (message.args && message.args.length > 0) {
                this.fulfillPending(address, message.args[0]);
            }
        });

        this.osc.on("error", (err: Error) => {
            console.error("OSC Error:", err);
        });
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("OSC socket open timeout"));
            }, 5000);

            this.osc.on("open", async () => {
                clearTimeout(timeout);
                this.isConnected = true;
                console.error("OSC UDP Port ready");

                try {
                    await this.verifyXAir();
                } catch (error) {
                    reject(error);
                    return;
                }

                this.sendCommand("/xremote");
                this.xremoteTimer = setInterval(
                    () => this.sendCommand("/xremote"),
                    9000
                );

                this.meterSubscription = new MeterSubscription(
                    this.host,
                    this.port,
                    (address, args) => this.sendCommand(address, args)
                );

                const forwardNotify = this.plugin.notify.bind(this.plugin);
                this.plugin.registerNotify((...args: any[]) => {
                    const data = args[0];
                    if (
                        Buffer.isBuffer(data) &&
                        data.length >= 7 &&
                        data.subarray(0, 7).toString("ascii") === "meters/"
                    ) {
                        this.meterSubscription?.handleRawPacket(data);
                        return;
                    }
                    forwardNotify(...args);
                });

                this.meterSubscription.start();

                resolve();
            });

            try {
                this.osc.open({ port: 0 });
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    private async verifyXAir(): Promise<void> {
        try {
            await this.sendAndReceiveWithTimeout("/xinfo", 500);
            console.error("X-Air mixer verified");
        } catch {
            throw new Error(
                "X-Air mixer did not respond to /xinfo. Check OSC_HOST and OSC_PORT (default 10024)."
            );
        }
    }

    private sendCommand(address: string, args?: any[]): void {
        if (!this.isConnected) {
            console.error("OSC not connected");
            return;
        }

        const message = new (OSC as any).Message(address, ...(args || []));
        this.osc.send(message);
    }

    private async sendAndReceive(address: string, args?: any[]): Promise<any> {
        return this.sendAndReceiveWithTimeout(address, 1000, args);
    }

    private fulfillPending(address: string, value: any): void {
        const queue = this.pendingRequests.get(address);
        if (!queue || queue.length === 0) return;

        const pending = queue.shift()!;
        clearTimeout(pending.timer);
        pending.resolve(value);

        if (queue.length === 0) {
            this.pendingRequests.delete(address);
        } else {
            const next = queue[0]!;
            this.sendCommand(address, next.args);
        }
    }

    private expirePending(address: string, pending: PendingOscRequest): void {
        const queue = this.pendingRequests.get(address);
        if (!queue) return;

        const index = queue.indexOf(pending);
        if (index < 0) return;

        queue.splice(index, 1);
        pending.reject(new Error(`Timeout waiting for response from ${address}`));

        if (queue.length === 0) {
            this.pendingRequests.delete(address);
        } else if (index === 0) {
            const next = queue[0]!;
            this.sendCommand(address, next.args);
        }
    }

    private async sendAndReceiveWithTimeout(
        address: string,
        timeoutMs: number,
        args?: any[]
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            const pending: PendingOscRequest = {
                resolve,
                reject,
                timer: setTimeout(
                    () => this.expirePending(address, pending),
                    timeoutMs
                ),
                args,
            };

            const queue = this.pendingRequests.get(address) ?? [];
            queue.push(pending);
            this.pendingRequests.set(address, queue);

            if (queue.length === 1) {
                this.sendCommand(address, args);
            }
        });
    }

    async queryParallel(
        paths: string[],
        timeoutMs = 1000,
        concurrency = 8
    ): Promise<Map<string, any>> {
        const uniquePaths = [...new Set(paths)];
        const results = new Map<string, any>();

        for (let i = 0; i < uniquePaths.length; i += concurrency) {
            const batch = uniquePaths.slice(i, i + concurrency);
            const pairs = await Promise.all(
                batch.map(async (path) => {
                    try {
                        const value = await this.sendAndReceiveWithTimeout(
                            path,
                            timeoutMs
                        );
                        return [path, value] as const;
                    } catch {
                        return [path, null] as const;
                    }
                })
            );
            for (const [path, value] of pairs) {
                results.set(path, value);
            }
        }

        return results;
    }

    /** X-Air fader scale: 0.0 = -inf, 0.75 = 0 dB, 1.0 = +10 dB */
    static levelToDb(level: number): number {
        if (level <= 0) return -100;
        return Math.round(40 * Math.log10(level / 0.75) * 10) / 10;
    }

    /** Inverse of FX send display formula: dB ≈ 66*log10(value)+8 */
    static fxLevelToDb(level: number): number {
        if (level <= 0) return -100;
        return Math.round((66 * Math.log10(level) + 8) * 10) / 10;
    }

    static formatPan(pan: number): string {
        return pan < -0.1 ? "left" : pan > 0.1 ? "right" : "center";
    }

    private normalizeChannelList(
        include: boolean | number[] | "all" | undefined,
        max: number
    ): number[] {
        if (include === false) return [];
        if (include === true || include === undefined || include === "all") {
            return Array.from({ length: max }, (_, i) => i + 1);
        }
        return include.filter((n) => n >= 1 && n <= max);
    }

    private getChannelPath(channel: number): string {
        return `/ch/${channel.toString().padStart(2, "0")}`;
    }

    private getBusPath(bus: number): string {
        return `/bus/${bus}`;
    }

    // ========== Channel Controls ==========

    async setFader(channel: number, level: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/mix/fader`;
        this.sendCommand(path, [level]);
    }

    async getFader(channel: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/mix/fader`;
        return await this.sendAndReceive(path);
    }

    async muteChannel(channel: number, mute: boolean): Promise<void> {
        const path = `${this.getChannelPath(channel)}/mix/on`;
        this.sendCommand(path, [mute ? 0 : 1]);
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /** Apply mutes with stagger + read-back verify; returns channels that failed to reach target. */
    private async applyChannelMutes(
        expected: Map<number, boolean>
    ): Promise<number[]> {
        const MUTE_STAGGER_MS = 25;
        let pending = new Map(expected);

        for (let attempt = 0; attempt < 3 && pending.size > 0; attempt++) {
            if (attempt > 0) {
                await this.delay(50);
            }

            for (const [ch, mute] of pending) {
                await this.muteChannel(ch, mute);
                await this.delay(MUTE_STAGGER_MS);
            }

            const failed: number[] = [];
            for (const [ch, wantMute] of pending) {
                try {
                    const actual = await this.getMute(ch);
                    if (actual !== wantMute) failed.push(ch);
                } catch {
                    failed.push(ch);
                }
            }

            if (failed.length === 0) return [];

            pending = new Map(
                failed.map((ch) => [ch, expected.get(ch)!] as const)
            );
        }

        return [...pending.keys()];
    }

    async getMute(channel: number): Promise<boolean> {
        const path = `${this.getChannelPath(channel)}/mix/on`;
        const value = await this.sendAndReceive(path);
        return value === 0;
    }

    async setPan(channel: number, pan: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/mix/pan`;
        const mixerPan = (pan + 1) / 2;
        this.sendCommand(path, [mixerPan]);
    }

    async getPan(channel: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/mix/pan`;
        const value = await this.sendAndReceive(path);
        return value * 2 - 1;
    }

    async setChannelName(channel: number, name: string): Promise<void> {
        const path = `${this.getChannelPath(channel)}/config/name`;
        this.sendCommand(path, [name]);
    }

    async getChannelName(channel: number): Promise<string> {
        const path = `${this.getChannelPath(channel)}/config/name`;
        return await this.sendAndReceive(path);
    }

    async setChannelColor(channel: number, color: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/config/color`;
        this.sendCommand(path, [color]);
    }

    // ========== Preamp / HPF (Low Cut) ==========
    // X-Air: /ch/{nn}/preamp/hpon (0/1), /ch/{nn}/preamp/hpf (frequency)
    // Behringer wiki: hpf 0.0-1.0 maps to 20-200 Hz (documented). Hardware supports 20-400 Hz, logarithmic scale.
    // Values outside 20-400 are clamped (e.g. 10→20, 500→400).

    async setHPFOn(channel: number, on: boolean): Promise<void> {
        const path = `${this.getChannelPath(channel)}/preamp/hpon`;
        this.sendCommand(path, [on ? 1 : 0]);
    }

    async getHPFOn(channel: number): Promise<boolean> {
        const path = `${this.getChannelPath(channel)}/preamp/hpon`;
        const value = await this.sendAndReceive(path);
        return value === 1;
    }

    async getHPF(channel: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/preamp/hpf`;
        return await this.sendAndReceive(path);
    }

    async getHPFHz(channel: number): Promise<number> {
        const norm = await this.getHPF(channel);
        const logRange = Math.log10(400) - Math.log10(20);
        return 20 * Math.pow(10, norm * logRange);
    }

    async setHPF(channel: number, frequencyHz: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/preamp/hpf`;
        // X-Air: 20-400 Hz, float 0.0-1.0 (logarithmic scale). Mixer quantizes to steps (coarser at high Hz).
        // Nudge +1 Hz below 250 only; no nudge at 250+ (user prefers e.g. 300→296 over 300→305).
        const hz = Math.max(20, Math.min(400, frequencyHz));
        const nudge = hz < 250 ? Math.min(400, hz + 1) : hz;
        const normalized =
            (Math.log10(nudge) - Math.log10(20)) /
            (Math.log10(400) - Math.log10(20));
        this.sendCommand(path, [normalized]);
    }

    // ========== EQ Controls ==========

    async setEQ(channel: number, band: number, gain: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/eq/${band}/g`;
        const mixerGain = (gain + 15) / 30;
        this.sendCommand(path, [mixerGain]);
    }

    async getEQ(channel: number, band: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/eq/${band}/g`;
        const value = await this.sendAndReceive(path);
        return value * 30 - 15;
    }

    async setEQFrequency(channel: number, band: number, frequency: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/eq/${band}/f`;
        const value =
            (Math.log10(Math.max(20, Math.min(20000, frequency))) - Math.log10(20)) /
            (Math.log10(20000) - Math.log10(20));
        this.sendCommand(path, [value]);
    }

    async setEQQ(channel: number, band: number, q: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/eq/${band}/q`;
        this.sendCommand(path, [q]);
    }

    async setEQType(channel: number, band: number, type: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/eq/${band}/type`;
        this.sendCommand(path, [type]);
    }

    async setEQOn(channel: number, on: boolean): Promise<void> {
        const path = `${this.getChannelPath(channel)}/eq/on`;
        this.sendCommand(path, [on ? 1 : 0]);
    }

    async getEQOn(channel: number): Promise<boolean> {
        const path = `${this.getChannelPath(channel)}/eq/on`;
        const value = await this.sendAndReceive(path);
        return value === 1;
    }

    async getEQFrequency(channel: number, band: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/eq/${band}/f`;
        const value = await this.sendAndReceive(path);
        const logRange = Math.log10(20000) - Math.log10(20);
        return Math.round(Math.pow(10, value * logRange + Math.log10(20)));
    }

    async getEQQ(channel: number, band: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/eq/${band}/q`;
        return await this.sendAndReceive(path);
    }

    // ========== Dynamics Controls ==========

    async setGate(channel: number, threshold: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/gate/thr`;
        const mixerThreshold = (threshold + 80) / 80;
        this.sendCommand(path, [mixerThreshold]);
    }

    async getGate(channel: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/gate/thr`;
        const value = await this.sendAndReceive(path);
        return value * 80 - 80;
    }

    async setGateRange(channel: number, range: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/gate/range`;
        this.sendCommand(path, [range]);
    }

    async setGateAttack(channel: number, attack: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/gate/attack`;
        this.sendCommand(path, [attack]);
    }

    async setGateHold(channel: number, hold: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/gate/hold`;
        this.sendCommand(path, [hold]);
    }

    async setGateRelease(channel: number, release: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/gate/release`;
        this.sendCommand(path, [release]);
    }

    async setGateOn(channel: number, on: boolean): Promise<void> {
        const path = `${this.getChannelPath(channel)}/gate/on`;
        this.sendCommand(path, [on ? 1 : 0]);
    }

    async getGateOn(channel: number): Promise<boolean> {
        const path = `${this.getChannelPath(channel)}/gate/on`;
        const value = await this.sendAndReceive(path);
        return value === 1;
    }

    async setCompressor(
        channel: number,
        threshold: number,
        ratio: number
    ): Promise<void> {
        const thrPath = `${this.getChannelPath(channel)}/dyn/thr`;
        const ratioPath = `${this.getChannelPath(channel)}/dyn/ratio`;
        const mixerThreshold = (threshold + 60) / 60;
        const ratioIndex = ratioToIndex(ratio);
        this.sendCommand(thrPath, [mixerThreshold]);
        this.sendCommand(ratioPath, [ratioIndex]);
    }

    async setCompressorAttack(channel: number, attack: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/dyn/attack`;
        this.sendCommand(path, [attack]);
    }

    async setCompressorRelease(channel: number, release: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/dyn/release`;
        this.sendCommand(path, [release]);
    }

    async setCompressorKnee(channel: number, knee: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/dyn/knee`;
        this.sendCommand(path, [knee]);
    }

    async setCompressorGain(channel: number, gain: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/dyn/gain`;
        this.sendCommand(path, [gain]);
    }

    async setCompressorOn(channel: number, on: boolean): Promise<void> {
        const path = `${this.getChannelPath(channel)}/dyn/on`;
        this.sendCommand(path, [on ? 1 : 0]);
    }

    async getCompressorOn(channel: number): Promise<boolean> {
        const path = `${this.getChannelPath(channel)}/dyn/on`;
        const value = await this.sendAndReceive(path);
        return value === 1;
    }

    async getCompressor(
        channel: number
    ): Promise<{ threshold: number; ratio: number }> {
        const thrPath = `${this.getChannelPath(channel)}/dyn/thr`;
        const ratioPath = `${this.getChannelPath(channel)}/dyn/ratio`;
        const [thrVal, ratioVal] = await Promise.all([
            this.sendAndReceive(thrPath),
            this.sendAndReceive(ratioPath),
        ]);
        return {
            threshold: Math.round((thrVal * 60 - 60) * 10) / 10,
            ratio: parseRatioOscValue(ratioVal),
        };
    }

    // ========== Bus Controls ==========

    async setBusFader(bus: number, level: number): Promise<void> {
        const path = `${this.getBusPath(bus)}/mix/fader`;
        this.sendCommand(path, [level]);
    }

    async getBusFader(bus: number): Promise<number> {
        const path = `${this.getBusPath(bus)}/mix/fader`;
        return await this.sendAndReceive(path);
    }

    async muteBus(bus: number, mute: boolean): Promise<void> {
        const path = `${this.getBusPath(bus)}/mix/on`;
        this.sendCommand(path, [mute ? 0 : 1]);
    }

    async getBusMute(bus: number): Promise<boolean> {
        const path = `${this.getBusPath(bus)}/mix/on`;
        const value = await this.sendAndReceive(path);
        return value === 0;
    }

    async setBusPan(bus: number, pan: number): Promise<void> {
        const path = `${this.getBusPath(bus)}/mix/pan`;
        const mixerPan = (pan + 1) / 2;
        this.sendCommand(path, [mixerPan]);
    }

    async setBusName(bus: number, name: string): Promise<void> {
        const path = `${this.getBusPath(bus)}/config/name`;
        this.sendCommand(path, [name]);
    }

    async getBusName(bus: number): Promise<string> {
        const path = `${this.getBusPath(bus)}/config/name`;
        return await this.sendAndReceive(path);
    }

    // ========== Sends ==========

    async sendToBus(channel: number, bus: number, level: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/mix/${bus.toString().padStart(2, "0")}/level`;
        this.sendCommand(path, [level]);
    }

    /**
     * Send channel to FX effect (FX 1-4 = buses 7-10).
     * Level uses X-Air scale: 0.0 = -∞dB, 0.75 = 0dB, 1.0 = +10dB.
     * For dB conversion: value = 0.75 * 10^(dB/40)
     */
    async sendToFx(channel: number, effect: number, level: number): Promise<void> {
        if (effect < 1 || effect > 4) return;
        const bus = 6 + effect; // FX 1→7, FX 2→8, FX 3→9, FX 4→10
        return this.sendToBus(channel, bus, level);
    }

    async getSendToFx(channel: number, effect: number): Promise<number> {
        if (effect < 1 || effect > 4) return 0;
        const bus = 6 + effect;
        return this.getSendToBus(channel, bus);
    }

    /**
     * Convert dB to X-Air FX send level (calibrated from X-Air Edit display).
     * Display formula: dB ≈ 66*log10(value)+8. Inverse: value = 10^((dB-8)/66)
     */
    static dbToLevel(db: number): number {
        if (db <= -100) return 0;
        return Math.max(0, Math.min(1, Math.pow(10, (db - 8) / 66)));
    }

    async getSendToBus(channel: number, bus: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/mix/${bus.toString().padStart(2, "0")}/level`;
        return await this.sendAndReceive(path);
    }

    async setSendPrePost(channel: number, bus: number, pre: boolean): Promise<void> {
        const path = `${this.getChannelPath(channel)}/mix/${bus.toString().padStart(2, "0")}/preamp`;
        this.sendCommand(path, [pre ? 1 : 0]);
    }

    // ========== Main Mix ==========

    async setMainFader(level: number): Promise<void> {
        this.sendCommand("/lr/mix/fader", [level]);
    }

    async getMainFader(): Promise<number> {
        return await this.sendAndReceive("/lr/mix/fader");
    }

    async muteMain(mute: boolean): Promise<void> {
        this.sendCommand("/lr/mix/on", [mute ? 0 : 1]);
    }

    async getMainMute(): Promise<boolean> {
        const value = await this.sendAndReceive("/lr/mix/on");
        return value === 0;
    }

    async setMainPan(pan: number): Promise<void> {
        const mixerPan = (pan + 1) / 2;
        this.sendCommand("/lr/mix/pan", [mixerPan]);
    }

    // ========== Effects (X-Air: 1-4) ==========

    async setEffectOn(effect: number, on: boolean): Promise<void> {
        if (effect < 1 || effect > 4) return;
        this.sendCommand(`/fx/${effect}/insert`, [on ? 1 : 0]);
    }

    async setEffectMix(effect: number, mix: number): Promise<void> {
        if (effect < 1 || effect > 4) return;
        this.sendCommand(`/fx/${effect}/mix`, [mix]);
    }

    async setEffectParam(effect: number, param: number, value: number): Promise<void> {
        if (effect < 1 || effect > 4) return;
        this.sendCommand(`/fx/${effect}/par/${param.toString().padStart(2, "0")}`, [value]);
    }

    // ========== Routing ==========

    async setChannelSource(channel: number, source: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/config/insrc`;
        const value = Math.max(0, Math.min(15, source));
        this.sendCommand(path, [value]);
    }

    async getChannelSource(channel: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/config/insrc`;
        return await this.sendAndReceive(path);
    }

    // ========== Scenes (X-Air: 1-64) ==========

    async recallScene(scene: number): Promise<void> {
        scene = Math.max(1, Math.min(64, Math.round(scene)));
        this.sendCommand("/-snap/load", [scene]);
    }

    async saveScene(scene: number, name?: string): Promise<void> {
        scene = Math.max(1, Math.min(64, Math.round(scene)));
        this.sendCommand("/-snap/load", [scene]);
        if (name) this.sendCommand("/-snap/name", [name]);
        this.sendCommand("/-snap/save", [scene]);
    }

    async getSceneName(scene: number): Promise<string> {
        scene = Math.max(1, Math.min(64, Math.round(scene)));
        try {
            const currentIndex = await this.sendAndReceive("/-snap/index");
            const current = typeof currentIndex === "number" ? currentIndex : Number(currentIndex);
            if (current === scene) {
                return await this.sendAndReceive("/-snap/name");
            }
        } catch {
            // ignore
        }
        return "";
    }

    // ========== Mixer read / overview ==========

    async getMixerOverview(options: {
        includeChannels?: boolean | number[] | "all";
        includeBuses?: boolean | number[] | "all";
        includeSends?: boolean;
        includeDynamics?: boolean;
    } = {}): Promise<MixerOverview> {
        const {
            includeChannels = true,
            includeBuses = true,
            includeSends = false,
            includeDynamics = false,
        } = options;

        const channelNums = this.normalizeChannelList(includeChannels, 16);
        const busNums = this.normalizeChannelList(includeBuses, 6);

        const globalPaths = [
            "/-snap/index",
            "/-snap/name",
            "/lr/mix/fader",
            "/lr/mix/on",
        ];

        const channelPaths: string[] = [];
        for (const ch of channelNums) {
            const base = this.getChannelPath(ch);
            channelPaths.push(
                `${base}/config/name`,
                `${base}/mix/fader`,
                `${base}/mix/on`,
                `${base}/mix/pan`,
                `${base}/config/insrc`,
                `${base}/preamp/hpf`,
                `${base}/preamp/hpon`
            );
            if (includeSends) {
                for (let bus = 1; bus <= 6; bus++) {
                    channelPaths.push(
                        `${base}/mix/${bus.toString().padStart(2, "0")}/level`
                    );
                }
            }
            if (includeDynamics) {
                channelPaths.push(`${base}/eq/on`);
                for (let band = 1; band <= 4; band++) {
                    channelPaths.push(
                        `${base}/eq/${band}/g`,
                        `${base}/eq/${band}/f`,
                        `${base}/eq/${band}/q`
                    );
                }
                channelPaths.push(
                    `${base}/gate/on`,
                    `${base}/gate/thr`,
                    `${base}/dyn/on`,
                    `${base}/dyn/thr`,
                    `${base}/dyn/ratio`
                );
            }
        }

        const busPaths: string[] = [];
        for (const bus of busNums) {
            const base = this.getBusPath(bus);
            busPaths.push(
                `${base}/config/name`,
                `${base}/mix/fader`,
                `${base}/mix/on`
            );
        }

        const results = await this.queryParallel([
            ...globalPaths,
            ...channelPaths,
            ...busPaths,
        ]);

        const sceneIndex = Number(results.get("/-snap/index") ?? 0);
        const sceneName = String(results.get("/-snap/name") ?? "");
        const mainFader = Number(results.get("/lr/mix/fader") ?? 0);
        const mainOn = results.get("/lr/mix/on");

        const overview: MixerOverview = {
            scene: { index: sceneIndex, name: sceneName },
            main: {
                fader: mainFader,
                faderDb: OSCClient.levelToDb(mainFader),
                muted: mainOn === 0,
            },
        };

        if (channelNums.length > 0) {
            overview.channels = channelNums.map((ch) => {
                const base = this.getChannelPath(ch);
                const fader = Number(results.get(`${base}/mix/fader`) ?? 0);
                const panNorm = Number(results.get(`${base}/mix/pan`) ?? 0.5);
                const panValue = panNorm * 2 - 1;
                const hpfNorm = Number(results.get(`${base}/preamp/hpf`) ?? 0);
                const logRange = Math.log10(400) - Math.log10(20);
                const hpfHz = Math.round(20 * Math.pow(10, hpfNorm * logRange));

                const entry: ChannelOverview = {
                    ch,
                    name: String(results.get(`${base}/config/name`) ?? ""),
                    fader,
                    faderDb: OSCClient.levelToDb(fader),
                    muted: results.get(`${base}/mix/on`) === 0,
                    pan: OSCClient.formatPan(panValue),
                    panValue: Math.round(panValue * 100) / 100,
                    source: Number(results.get(`${base}/config/insrc`) ?? 0),
                    hpfHz,
                    hpfOn: results.get(`${base}/preamp/hpon`) === 1,
                };

                if (includeSends) {
                    entry.sends = {};
                    for (let bus = 1; bus <= 6; bus++) {
                        const key = `bus${bus}`;
                        entry.sends[key] = Number(
                            results.get(
                                `${base}/mix/${bus.toString().padStart(2, "0")}/level`
                            ) ?? 0
                        );
                    }
                }

                if (includeDynamics) {
                    const eqBands = [];
                    for (let band = 1; band <= 4; band++) {
                        const gNorm = Number(
                            results.get(`${base}/eq/${band}/g`) ?? 0.5
                        );
                        const fNorm = Number(
                            results.get(`${base}/eq/${band}/f`) ?? 0
                        );
                        const eqLogRange =
                            Math.log10(20000) - Math.log10(20);
                        eqBands.push({
                            band,
                            gain: Math.round((gNorm * 30 - 15) * 10) / 10,
                            frequency: Math.round(
                                Math.pow(10, fNorm * eqLogRange + Math.log10(20))
                            ),
                            q: Number(results.get(`${base}/eq/${band}/q`) ?? 0),
                        });
                    }
                    const thrNorm = Number(
                        results.get(`${base}/gate/thr`) ?? 0
                    );
                    const compThrNorm = Number(
                        results.get(`${base}/dyn/thr`) ?? 0
                    );
                    const compRatioRaw = results.get(`${base}/dyn/ratio`) ?? 0;
                    entry.dynamics = {
                        eqOn: results.get(`${base}/eq/on`) === 1,
                        eq: eqBands,
                        gateOn: results.get(`${base}/gate/on`) === 1,
                        gateThreshold:
                            Math.round((thrNorm * 80 - 80) * 10) / 10,
                        compressorOn: results.get(`${base}/dyn/on`) === 1,
                        compressor: {
                            threshold:
                                Math.round((compThrNorm * 60 - 60) * 10) / 10,
                            ratio: parseRatioOscValue(compRatioRaw),
                        },
                    };
                }

                return entry;
            });
        }

        if (busNums.length > 0) {
            overview.buses = busNums.map((bus) => {
                const base = this.getBusPath(bus);
                const fader = Number(results.get(`${base}/mix/fader`) ?? 0);
                return {
                    bus,
                    name: String(results.get(`${base}/config/name`) ?? ""),
                    fader,
                    faderDb: OSCClient.levelToDb(fader),
                    muted: results.get(`${base}/mix/on`) === 0,
                };
            });
        }

        return overview;
    }

    async getChannelDetail(channel: number): Promise<ChannelDetail> {
        if (channel < 1 || channel > 16) {
            throw new Error("Channel must be 1-16");
        }

        const base = this.getChannelPath(channel);
        const paths = [
            `${base}/config/name`,
            `${base}/config/insrc`,
            `${base}/mix/fader`,
            `${base}/mix/on`,
            `${base}/mix/pan`,
            `${base}/preamp/hpon`,
            `${base}/preamp/hpf`,
            `${base}/eq/on`,
            ...Array.from({ length: 4 }, (_, i) => [
                `${base}/eq/${i + 1}/g`,
                `${base}/eq/${i + 1}/f`,
                `${base}/eq/${i + 1}/q`,
            ]).flat(),
            `${base}/gate/on`,
            `${base}/gate/thr`,
            `${base}/dyn/on`,
            `${base}/dyn/thr`,
            `${base}/dyn/ratio`,
            ...Array.from({ length: 6 }, (_, i) =>
                `${base}/mix/${String(i + 1).padStart(2, "0")}/level`
            ),
            ...Array.from({ length: 4 }, (_, i) =>
                `${base}/mix/${String(7 + i).padStart(2, "0")}/level`
            ),
        ];

        const results = await this.queryParallel(paths);

        const fader = Number(results.get(`${base}/mix/fader`) ?? 0);
        const panNorm = Number(results.get(`${base}/mix/pan`) ?? 0.5);
        const panValue = panNorm * 2 - 1;
        const hpfNorm = Number(results.get(`${base}/preamp/hpf`) ?? 0);
        const logRange = Math.log10(400) - Math.log10(20);
        const hpfHz = Math.round(20 * Math.pow(10, hpfNorm * logRange));
        const eqLogRange = Math.log10(20000) - Math.log10(20);

        const sendsToBus: Record<string, { level: number; levelDb: number }> =
            {};
        for (let bus = 1; bus <= 6; bus++) {
            const level = Number(
                results.get(
                    `${base}/mix/${String(bus).padStart(2, "0")}/level`
                ) ?? 0
            );
            sendsToBus[`bus${bus}`] = {
                level,
                levelDb: OSCClient.levelToDb(level),
            };
        }

        const sendsToFx: Record<string, { level: number; levelDb: number }> =
            {};
        for (let fx = 1; fx <= 4; fx++) {
            const level = Number(
                results.get(
                    `${base}/mix/${String(6 + fx).padStart(2, "0")}/level`
                ) ?? 0
            );
            sendsToFx[`fx${fx}`] = {
                level,
                levelDb: OSCClient.fxLevelToDb(level),
            };
        }

        const thrNorm = Number(results.get(`${base}/gate/thr`) ?? 0);
        const compThrNorm = Number(results.get(`${base}/dyn/thr`) ?? 0);
        const compRatioRaw = results.get(`${base}/dyn/ratio`) ?? 0;

        return {
            ch: channel,
            name: String(results.get(`${base}/config/name`) ?? ""),
            source: Number(results.get(`${base}/config/insrc`) ?? 0),
            fader,
            faderDb: OSCClient.levelToDb(fader),
            muted: results.get(`${base}/mix/on`) === 0,
            pan: OSCClient.formatPan(panValue),
            panValue: Math.round(panValue * 100) / 100,
            hpf: {
                on: results.get(`${base}/preamp/hpon`) === 1,
                hz: hpfHz,
            },
            eq: {
                on: results.get(`${base}/eq/on`) === 1,
                bands: Array.from({ length: 4 }, (_, i) => {
                    const band = i + 1;
                    const gNorm = Number(
                        results.get(`${base}/eq/${band}/g`) ?? 0.5
                    );
                    const fNorm = Number(
                        results.get(`${base}/eq/${band}/f`) ?? 0
                    );
                    return {
                        band,
                        gain: Math.round((gNorm * 30 - 15) * 10) / 10,
                        frequency: Math.round(
                            Math.pow(10, fNorm * eqLogRange + Math.log10(20))
                        ),
                        q: Number(results.get(`${base}/eq/${band}/q`) ?? 0),
                    };
                }),
            },
            gate: {
                on: results.get(`${base}/gate/on`) === 1,
                threshold: Math.round((thrNorm * 80 - 80) * 10) / 10,
            },
            compressor: {
                on: results.get(`${base}/dyn/on`) === 1,
                threshold: Math.round((compThrNorm * 60 - 60) * 10) / 10,
                ratio: parseRatioOscValue(compRatioRaw),
            },
            sendsToBus,
            sendsToFx,
        };
    }

    async getMeters(options: {
        mode?: "cache" | "snapshot";
        groups?: MeterGroup[];
    } = {}): Promise<MeterSnapshot> {
        const { mode = "cache", groups = ["input", "mix"] } = options;
        if (!this.meterSubscription) {
            return {
                updatedAt: null,
                source: mode,
                hotChannels: [],
                silentChannels: [],
            };
        }
        if (mode === "snapshot") {
            return this.meterSubscription.getSnapshot(groups);
        }
        return this.meterSubscription.getCache(groups);
    }

    // ========== Status ==========

    async getMixerStatus(): Promise<any> {
        const paths = [
            "/xinfo",
            "/-snap/index",
            "/-snap/name",
            "/lr/mix/fader",
            "/lr/mix/on",
        ];
        const results = await this.queryParallel(paths, 1500);
        const info = results.get("/xinfo");

        if (info == null) {
            return {
                connected: false,
                host: this.host,
                port: this.port,
                mixerFamily: "x-air",
                error: "X-Air mixer did not respond to /xinfo",
            };
        }

        const mainFader = Number(results.get("/lr/mix/fader") ?? 0);
        return {
            connected: true,
            host: this.host,
            port: this.port,
            mixerFamily: "x-air",
            effectsRange: "1-4",
            scenesRange: "1-64",
            info,
            scene: {
                index: Number(results.get("/-snap/index") ?? 0),
                name: String(results.get("/-snap/name") ?? ""),
            },
            main: {
                fader: mainFader,
                faderDb: OSCClient.levelToDb(mainFader),
                muted: results.get("/lr/mix/on") === 0,
            },
        };
    }

    // ========== Custom Commands ==========

    async sendCustomCommand(address: string, value?: any): Promise<void> {
        if (value === undefined) {
            this.sendCommand(address);
        } else {
            this.sendCommand(address, Array.isArray(value) ? value : [value]);
        }
    }

    // ========== Composite Workflows ==========

    async applyChannelPreset(
        channelRef: number | string,
        presetId: string,
        options: { dryRun?: boolean } = {}
    ): Promise<{
        ok: boolean;
        dryRun: boolean;
        channel: number;
        channelName: string;
        preset: string;
        changes: CompositeChange[];
    }> {
        const index = await fetchChannelNameIndex(this);
        const channel = resolveChannelRef(channelRef, index);
        const preset = getPreset(presetId);
        const changes = buildPresetChanges(channel, preset);
        const dryRun = options.dryRun ?? false;

        if (!dryRun) {
            await this.setHPFOn(channel, preset.hpf.on);
            await this.setHPF(channel, preset.hpf.frequencyHz);
            await this.setEQOn(channel, preset.eq.on);
            for (const band of preset.eq.bands) {
                await this.setEQ(channel, band.band, band.gain);
                if (band.frequency !== undefined) {
                    await this.setEQFrequency(channel, band.band, band.frequency);
                }
                if (band.q !== undefined) {
                    await this.setEQQ(channel, band.band, band.q);
                }
            }
            if (preset.gate) {
                await this.setGateOn(channel, preset.gate.on);
                await this.setGate(channel, preset.gate.threshold);
            }
            if (preset.compressor) {
                await this.setCompressorOn(channel, preset.compressor.on);
                await this.setCompressor(
                    channel,
                    preset.compressor.threshold,
                    preset.compressor.ratio
                );
                if (preset.compressor.attack !== undefined) {
                    await this.setCompressorAttack(
                        channel,
                        preset.compressor.attack
                    );
                }
                if (preset.compressor.release !== undefined) {
                    await this.setCompressorRelease(
                        channel,
                        preset.compressor.release
                    );
                }
            }
            if (preset.fxSend) {
                await this.sendToFx(
                    channel,
                    preset.fxSend.effect,
                    OSCClient.dbToLevel(preset.fxSend.levelDb)
                );
            }
        }

        return {
            ok: true,
            dryRun,
            channel,
            channelName: index.names[channel] ?? "",
            preset: presetId,
            changes: changes.map((c) => ({ ...c, applied: !dryRun })),
        };
    }

    async muteAllExcept(
        channelRefs: (number | string)[],
        options: { includeMain?: boolean; dryRun?: boolean } = {}
    ): Promise<{
        ok: boolean;
        dryRun: boolean;
        kept: Array<{ channel: number; name: string }>;
        muted: Array<{ channel: number; name: string }>;
        includeMain: boolean;
        failures?: number[];
        changes: CompositeChange[];
    }> {
        const index = await fetchChannelNameIndex(this);
        const keptChannels = resolveChannelRefs(channelRefs, index);
        const keepSet = new Set(keptChannels);
        const dryRun = options.dryRun ?? false;
        const includeMain = options.includeMain ?? false;
        const changes: CompositeChange[] = [];
        const muted: number[] = [];

        for (let ch = 1; ch <= 16; ch++) {
            const shouldMute = !keepSet.has(ch);
            if (shouldMute) muted.push(ch);
            changes.push({
                target: `ch${String(ch).padStart(2, "0")}.mute`,
                action: "set",
                value: shouldMute,
            });
        }

        if (includeMain) {
            changes.push({
                target: "main.mute",
                action: "set",
                value: false,
            });
        }

        let failures: number[] = [];
        if (!dryRun) {
            const expected = new Map<number, boolean>();
            for (let ch = 1; ch <= 16; ch++) {
                expected.set(ch, !keepSet.has(ch));
            }
            failures = await this.applyChannelMutes(expected);
            if (includeMain) {
                await this.muteMain(false);
            }
        }

        const failureSet = new Set(failures);

        return {
            ok: failures.length === 0,
            dryRun,
            kept: keptChannels.map((ch) => ({
                channel: ch,
                name: index.names[ch] ?? "",
            })),
            muted: muted.map((ch) => ({
                channel: ch,
                name: index.names[ch] ?? "",
            })),
            includeMain,
            ...(failures.length > 0 ? { failures } : {}),
            changes: changes.map((c) => {
                if (dryRun) return { ...c, applied: false };
                const match = /^ch(\d{2})\.mute$/.exec(c.target);
                if (match) {
                    const ch = Number(match[1]);
                    return { ...c, applied: !failureSet.has(ch) };
                }
                return { ...c, applied: true };
            }),
        };
    }

    async soundcheckChannel(channelRef: number | string): Promise<{
        ok: boolean;
        channel: number;
        name: string;
        fader: number;
        faderDb: number;
        muted: boolean;
        pan: string;
        hpf: ChannelDetail["hpf"];
        eqSummary: { on: boolean; bands: ChannelDetail["eq"]["bands"] };
        dynamicsSummary: {
            gate: ChannelDetail["gate"];
            compressor: ChannelDetail["compressor"];
        };
        sendsToBus: ChannelDetail["sendsToBus"];
        sendsToFx: ChannelDetail["sendsToFx"];
        meters: { inputDb: number | null; mixDb: number | null };
        flags: { hot: boolean; silent: boolean };
    }> {
        const index = await fetchChannelNameIndex(this);
        const channel = resolveChannelRef(channelRef, index);
        const [detail, meterSnapshot] = await Promise.all([
            this.getChannelDetail(channel),
            this.getMeters({ mode: "cache", groups: ["input", "mix"] }),
        ]);

        const inputKey = `input${String(channel).padStart(2, "0")}`;
        const mixKey = `ch${String(channel).padStart(2, "0")}`;
        const inputDb = meterSnapshot.input?.[inputKey] ?? null;
        const mixDb = meterSnapshot.mix?.[mixKey] ?? null;
        const levelForFlags = mixDb ?? inputDb;
        const hot =
            levelForFlags !== null && levelForFlags > METER_HOT_DB;
        const silent =
            levelForFlags !== null && levelForFlags < METER_SILENT_DB;

        return {
            ok: true,
            channel,
            name: detail.name,
            fader: detail.fader,
            faderDb: detail.faderDb,
            muted: detail.muted,
            pan: detail.pan,
            hpf: detail.hpf,
            eqSummary: {
                on: detail.eq.on,
                bands: detail.eq.bands,
            },
            dynamicsSummary: {
                gate: detail.gate,
                compressor: detail.compressor,
            },
            sendsToBus: detail.sendsToBus,
            sendsToFx: detail.sendsToFx,
            meters: { inputDb, mixDb },
            flags: { hot, silent },
        };
    }

    async setupMonitorMix(
        bus: number,
        name: string,
        channels: Array<
            number | string | { channel: number | string; level?: number; levelDb?: number }
        >,
        options: { busFader?: number; dryRun?: boolean } = {}
    ): Promise<{
        ok: boolean;
        dryRun: boolean;
        bus: number;
        name: string;
        busFader: number;
        channels: Array<{ channel: number; name: string; level: number }>;
        changes: CompositeChange[];
    }> {
        if (bus < 1 || bus > 6) {
            throw new Error("Bus must be 1-6");
        }

        const index = await fetchChannelNameIndex(this);
        const dryRun = options.dryRun ?? false;
        const busFader = options.busFader ?? 0.75;
        const changes: CompositeChange[] = [];
        const sends: Array<{ channel: number; name: string; level: number }> =
            [];

        changes.push({
            target: `bus${bus}.name`,
            action: "set",
            value: name,
        });
        changes.push({
            target: `bus${bus}.fader`,
            action: "set",
            value: busFader,
        });

        for (const entry of channels) {
            let channelRef: number | string;
            let level = 0.75;

            if (typeof entry === "object" && entry !== null && "channel" in entry) {
                channelRef = entry.channel;
                if (entry.levelDb !== undefined) {
                    level = OSCClient.dbToLevel(entry.levelDb);
                } else if (entry.level !== undefined) {
                    level = entry.level;
                }
            } else {
                channelRef = entry;
            }

            const ch = resolveChannelRef(channelRef, index);
            sends.push({ channel: ch, name: index.names[ch] ?? "", level });
            changes.push({
                target: `ch${String(ch).padStart(2, "0")}.send.bus${String(bus).padStart(2, "0")}`,
                action: "set",
                value: level,
            });
        }

        if (!dryRun) {
            await this.setBusName(bus, name);
            await this.setBusFader(bus, busFader);
            for (const send of sends) {
                await this.sendToBus(send.channel, bus, send.level);
            }
        }

        return {
            ok: true,
            dryRun,
            bus,
            name,
            busFader,
            channels: sends,
            changes: changes.map((c) => ({ ...c, applied: !dryRun })),
        };
    }

    close(): void {
        this.isConnected = false;
        for (const queue of this.pendingRequests.values()) {
            for (const pending of queue) {
                clearTimeout(pending.timer);
                pending.reject(new Error("OSC client closed"));
            }
        }
        this.pendingRequests.clear();
        if (this.xremoteTimer) {
            clearInterval(this.xremoteTimer);
            this.xremoteTimer = null;
        }
        this.meterSubscription?.stop();
        this.meterSubscription = null;
        this.osc.close();
    }
}
