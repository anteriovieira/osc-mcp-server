import OSC from "osc-js";

export class OSCClient {
    private osc: any;
    private host: string;
    private port: number;
    private responseCallbacks: Map<string, (value: any) => void> = new Map();
    private isConnected: boolean = false;

    constructor(host: string, port: number) {
        this.host = host;
        this.port = port;

        // Create OSC instance with UDP plugin
        const plugin = new (OSC as any).DatagramPlugin({
            send: {
                host: this.host,
                port: this.port,
            },
        });

        this.osc = new (OSC as any)({
            plugin: plugin,
        });

        // Handle incoming OSC messages
        this.osc.on("*", (message: any) => {
            const address = message.address;
            const callback = this.responseCallbacks.get(address);

            if (callback && message.args && message.args.length > 0) {
                callback(message.args[0]);
                this.responseCallbacks.delete(address);
            }
        });

        this.osc.on("error", (err: Error) => {
            console.error("OSC Error:", err);
        });
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Open OSC connection (listening on any available port)
                this.osc.open({
                    port: 0, // Use any available port
                });

                this.isConnected = true;
                console.error("OSC UDP Port ready");

                // Subscribe to mixer updates (/xcontrol for parameter updates)
                this.sendCommand("/xcontrol");

                // Keep connection alive with periodic /xremote messages
                setInterval(() => this.sendCommand("/xremote"), 9000);

                resolve();
            } catch (error) {
                reject(error);
            }
        });
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
        return new Promise((resolve, reject) => {
            this.responseCallbacks.set(address, resolve);
            this.sendCommand(address, args);

            // Timeout after 1 second
            setTimeout(() => {
                if (this.responseCallbacks.has(address)) {
                    this.responseCallbacks.delete(address);
                    reject(new Error(`Timeout waiting for response from ${address}`));
                }
            }, 1000);
        });
    }

    private getChannelPath(channel: number): string {
        return `/ch/${channel.toString().padStart(2, "0")}`;
    }

    private getBusPath(bus: number): string {
        return `/bus/${bus.toString().padStart(2, "0")}`;
    }

    private getAuxPath(aux: number): string {
        return `/aux/${aux.toString().padStart(2, "0")}`;
    }

    private getMatrixPath(matrix: number): string {
        return `/mtx/${matrix.toString().padStart(2, "0")}`;
    }

    private getDCAPath(dca: number): string {
        return `/dca/${dca}`;
    }

    private getHeadampPath(headamp: number): string {
        return `/headamp/${headamp.toString().padStart(3, "0")}`;
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
        // Mixer uses 1 for ON (unmuted) and 0 for OFF (muted)
        this.sendCommand(path, [mute ? 0 : 1]);
    }

    async getMute(channel: number): Promise<boolean> {
        const path = `${this.getChannelPath(channel)}/mix/on`;
        const value = await this.sendAndReceive(path);
        return value === 0;
    }

    async setPan(channel: number, pan: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/mix/pan`;
        // Convert -1 to 1 range to 0 to 1 range (0 = left, 0.5 = center, 1 = right)
        const mixerPan = (pan + 1) / 2;
        this.sendCommand(path, [mixerPan]);
    }

    async getPan(channel: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/mix/pan`;
        const value = await this.sendAndReceive(path);
        // Convert 0-1 range to -1 to 1 range
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

    // ========== EQ Controls ==========

    async setEQ(channel: number, band: number, gain: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/eq/${band}/g`;
        // Convert dB to mixer range (0.0 to 1.0, where 0.5 is 0dB)
        const mixerGain = (gain + 15) / 30; // -15dB to +15dB mapped to 0-1
        this.sendCommand(path, [mixerGain]);
    }

    async getEQ(channel: number, band: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/eq/${band}/g`;
        const value = await this.sendAndReceive(path);
        // Convert mixer range to dB
        return value * 30 - 15;
    }

    async setEQFrequency(channel: number, band: number, frequency: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/eq/${band}/f`;
        this.sendCommand(path, [frequency]);
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

    // ========== Dynamics Controls ==========

    async setGate(channel: number, threshold: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/gate/thr`;
        // Convert dB to mixer range
        const mixerThreshold = (threshold + 80) / 80; // -80dB to 0dB mapped to 0-1
        this.sendCommand(path, [mixerThreshold]);
    }

    async getGate(channel: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/gate/thr`;
        const value = await this.sendAndReceive(path);
        return value * 80 - 80;
    }

    async setGateOn(channel: number, on: boolean): Promise<void> {
        const path = `${this.getChannelPath(channel)}/gate/on`;
        this.sendCommand(path, [on ? 1 : 0]);
    }

    async setCompressor(
        channel: number,
        threshold: number,
        ratio: number
    ): Promise<void> {
        const thrPath = `${this.getChannelPath(channel)}/dyn/thr`;
        const ratioPath = `${this.getChannelPath(channel)}/dyn/ratio`;

        // Convert threshold dB to mixer range
        const mixerThreshold = (threshold + 60) / 60; // -60dB to 0dB mapped to 0-1
        this.sendCommand(thrPath, [mixerThreshold]);

        // Convert ratio to mixer range
        const mixerRatio = (ratio - 1) / 19; // 1:1 to 20:1 mapped to 0-1
        this.sendCommand(ratioPath, [mixerRatio]);
    }

    async setCompressorAttack(channel: number, attack: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/dyn/attack`;
        this.sendCommand(path, [attack]);
    }

    async setCompressorRelease(channel: number, release: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/dyn/release`;
        this.sendCommand(path, [release]);
    }

    async setCompressorGain(channel: number, gain: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/dyn/gain`;
        this.sendCommand(path, [gain]);
    }

    async setCompressorOn(channel: number, on: boolean): Promise<void> {
        const path = `${this.getChannelPath(channel)}/dyn/on`;
        this.sendCommand(path, [on ? 1 : 0]);
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

    async setBusPan(bus: number, pan: number): Promise<void> {
        const path = `${this.getBusPath(bus)}/mix/pan`;
        const mixerPan = (pan + 1) / 2;
        this.sendCommand(path, [mixerPan]);
    }

    async setBusName(bus: number, name: string): Promise<void> {
        const path = `${this.getBusPath(bus)}/config/name`;
        this.sendCommand(path, [name]);
    }

    // ========== Aux Controls ==========

    async setAuxFader(aux: number, level: number): Promise<void> {
        const path = `${this.getAuxPath(aux)}/mix/fader`;
        this.sendCommand(path, [level]);
    }

    async getAuxFader(aux: number): Promise<number> {
        const path = `${this.getAuxPath(aux)}/mix/fader`;
        return await this.sendAndReceive(path);
    }

    async muteAux(aux: number, mute: boolean): Promise<void> {
        const path = `${this.getAuxPath(aux)}/mix/on`;
        this.sendCommand(path, [mute ? 0 : 1]);
    }

    async setAuxPan(aux: number, pan: number): Promise<void> {
        const path = `${this.getAuxPath(aux)}/mix/pan`;
        const mixerPan = (pan + 1) / 2;
        this.sendCommand(path, [mixerPan]);
    }

    // ========== Sends ==========

    async sendToBus(channel: number, bus: number, level: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/mix/${bus.toString().padStart(2, "0")}/level`;
        this.sendCommand(path, [level]);
    }

    async getSendToBus(channel: number, bus: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/mix/${bus.toString().padStart(2, "0")}/level`;
        return await this.sendAndReceive(path);
    }

    async sendToAux(channel: number, aux: number, level: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/mix/${(aux + 15).toString().padStart(2, "0")}/level`;
        this.sendCommand(path, [level]);
    }

    async setSendPrePost(channel: number, bus: number, pre: boolean): Promise<void> {
        const path = `${this.getChannelPath(channel)}/mix/${bus.toString().padStart(2, "0")}/preamp`;
        this.sendCommand(path, [pre ? 1 : 0]);
    }

    // ========== Main Mix ==========

    async setMainFader(level: number): Promise<void> {
        this.sendCommand("/main/st/mix/fader", [level]);
    }

    async getMainFader(): Promise<number> {
        return await this.sendAndReceive("/main/st/mix/fader");
    }

    async muteMain(mute: boolean): Promise<void> {
        this.sendCommand("/main/st/mix/on", [mute ? 0 : 1]);
    }

    async setMainPan(pan: number): Promise<void> {
        const path = "/main/st/mix/pan";
        const mixerPan = (pan + 1) / 2;
        this.sendCommand(path, [mixerPan]);
    }

    // ========== Matrix ==========

    async setMatrixFader(matrix: number, level: number): Promise<void> {
        const path = `/mtx/${matrix.toString().padStart(2, "0")}/mix/fader`;
        this.sendCommand(path, [level]);
    }

    async muteMatrix(matrix: number, mute: boolean): Promise<void> {
        const path = `/mtx/${matrix.toString().padStart(2, "0")}/mix/on`;
        this.sendCommand(path, [mute ? 0 : 1]);
    }

    // ========== Effects ==========

    async setEffectOn(effect: number, on: boolean): Promise<void> {
        const path = `/fx/${effect.toString().padStart(2, "0")}/on`;
        this.sendCommand(path, [on ? 1 : 0]);
    }

    async setEffectMix(effect: number, mix: number): Promise<void> {
        const path = `/fx/${effect.toString().padStart(2, "0")}/mix`;
        this.sendCommand(path, [mix]);
    }

    async setEffectParam(effect: number, param: number, value: number): Promise<void> {
        const path = `/fx/${effect.toString().padStart(2, "0")}/par/${param.toString().padStart(2, "0")}`;
        this.sendCommand(path, [value]);
    }

    // ========== Routing ==========

    async setChannelSource(channel: number, source: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/config/source`;
        this.sendCommand(path, [source]);
    }

    async getChannelSource(channel: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/config/source`;
        return await this.sendAndReceive(path);
    }

    // ========== Scenes ==========

    async recallScene(scene: number): Promise<void> {
        const path = `/-snap/load`;
        this.sendCommand(path, [scene - 1]); // Mixer scenes are 0-indexed
    }

    async saveScene(scene: number, name?: string): Promise<void> {
        const path = `/-snap/store`;
        this.sendCommand(path, [scene - 1]);
        if (name) {
            const namePath = `/-snap/${(scene - 1).toString().padStart(3, "0")}/name`;
            this.sendCommand(namePath, [name]);
        }
    }

    async getSceneName(scene: number): Promise<string> {
        const path = `/-snap/${(scene - 1).toString().padStart(3, "0")}/name`;
        return await this.sendAndReceive(path);
    }

    // ========== Meters ==========

    async getChannelMeter(channel: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/mix/fader`;
        // Note: Meters are typically sent automatically by the mixer
        // This is a placeholder - actual meter data comes via /meters
        return await this.sendAndReceive(path);
    }

    // ========== System Commands ==========

    async getInfo(): Promise<any> {
        // /info returns: server_version, server_name, console_model, console_version
        return await this.sendAndReceive("/info");
    }

    async enableXControl(): Promise<void> {
        // /xcontrol enables parameter updates (up to 4 clients, 10 second timeout)
        this.sendCommand("/xcontrol");
    }

    // ========== Preamp Controls ==========

    async setPreampGain(channel: number, gain: number): Promise<void> {
        // gain: -12dB to +60dB (0.0-1.0 range)
        const path = `${this.getChannelPath(channel)}/preamp/trim`;
        this.sendCommand(path, [gain]);
    }

    async getPreampGain(channel: number): Promise<number> {
        const path = `${this.getChannelPath(channel)}/preamp/trim`;
        return await this.sendAndReceive(path);
    }

    async setHighPassFilter(channel: number, enabled: boolean): Promise<void> {
        const path = `${this.getChannelPath(channel)}/preamp/hpon`;
        this.sendCommand(path, [enabled ? 1 : 0]);
    }

    async setHighPassFilterFrequency(channel: number, frequency: number): Promise<void> {
        // frequency: 20Hz to 400Hz (0.0-1.0 range)
        const path = `${this.getChannelPath(channel)}/preamp/hpf`;
        this.sendCommand(path, [frequency]);
    }

    async setPhantomPower(headamp: number, enabled: boolean): Promise<void> {
        const path = `${this.getHeadampPath(headamp)}/phantom`;
        this.sendCommand(path, [enabled ? 1 : 0]);
    }

    // ========== Insert Effects ==========

    async setInsertOn(channel: number, enabled: boolean): Promise<void> {
        const path = `${this.getChannelPath(channel)}/insert/on`;
        this.sendCommand(path, [enabled ? 1 : 0]);
    }

    async setInsertPosition(channel: number, position: number): Promise<void> {
        // position: 0=PRE, 1=POST (or PRE/POST/INS based on protocol)
        const path = `${this.getChannelPath(channel)}/insert/pos`;
        this.sendCommand(path, [position]);
    }

    async setInsertSelection(channel: number, selection: number): Promise<void> {
        // selection: effect slot (OFF, FX1L, FX1R, etc.)
        const path = `${this.getChannelPath(channel)}/insert/sel`;
        this.sendCommand(path, [selection]);
    }

    // ========== Solo Controls ==========

    async setSolo(channel: number, solo: boolean): Promise<void> {
        const path = `${this.getChannelPath(channel)}/mix/solo`;
        this.sendCommand(path, [solo ? 1 : 0]);
    }

    async getSolo(channel: number): Promise<boolean> {
        const path = `${this.getChannelPath(channel)}/mix/solo`;
        const value = await this.sendAndReceive(path);
        return value === 1;
    }

    // ========== DCA Groups ==========

    async setDCAOn(dca: number, on: boolean): Promise<void> {
        const path = `${this.getDCAPath(dca)}/on`;
        this.sendCommand(path, [on ? 1 : 0]);
    }

    async setDCAFader(dca: number, level: number): Promise<void> {
        const path = `${this.getDCAPath(dca)}/fader`;
        this.sendCommand(path, [level]);
    }

    async getDCAFader(dca: number): Promise<number> {
        const path = `${this.getDCAPath(dca)}/fader`;
        return await this.sendAndReceive(path);
    }

    async setDCAName(dca: number, name: string): Promise<void> {
        const path = `${this.getDCAPath(dca)}/config/name`;
        this.sendCommand(path, [name]);
    }

    // ========== Output Controls ==========

    async setOutputSource(outputType: "main" | "aux" | "p16" | "aes" | "rec", output: number, source: number): Promise<void> {
        const path = `/outputs/${outputType}/${output.toString().padStart(2, "0")}/src`;
        this.sendCommand(path, [source]);
    }

    async setOutputPosition(outputType: "main" | "aux" | "p16" | "aes" | "rec", output: number, position: number): Promise<void> {
        // position: 0=PRE_EQ, 1=POST_EQ, 2=PRE, 3=POST
        const path = `/outputs/${outputType}/${output.toString().padStart(2, "0")}/pos`;
        this.sendCommand(path, [position]);
    }

    async setOutputDelay(outputType: "main" | "aux" | "p16" | "aes" | "rec", output: number, enabled: boolean): Promise<void> {
        const path = `/outputs/${outputType}/${output.toString().padStart(2, "0")}/delay/on`;
        this.sendCommand(path, [enabled ? 1 : 0]);
    }

    async setOutputDelayTime(outputType: "main" | "aux" | "p16" | "aes" | "rec", output: number, time: number): Promise<void> {
        // time: 0.3ms to 500ms (0.0-1.0 range)
        const path = `/outputs/${outputType}/${output.toString().padStart(2, "0")}/delay/tim`;
        this.sendCommand(path, [time]);
    }

    // ========== Main Mono ==========

    async setMainMonoFader(level: number): Promise<void> {
        this.sendCommand("/main/m/mix/fader", [level]);
    }

    async getMainMonoFader(): Promise<number> {
        return await this.sendAndReceive("/main/m/mix/fader");
    }

    async muteMainMono(mute: boolean): Promise<void> {
        this.sendCommand("/main/m/mix/on", [mute ? 0 : 1]);
    }

    // ========== Matrix Controls ==========

    async setMatrixName(matrix: number, name: string): Promise<void> {
        const path = `${this.getMatrixPath(matrix)}/config/name`;
        this.sendCommand(path, [name]);
    }

    async getMatrixName(matrix: number): Promise<string> {
        const path = `${this.getMatrixPath(matrix)}/config/name`;
        return await this.sendAndReceive(path);
    }

    async sendToMatrix(channel: number, matrix: number, level: number): Promise<void> {
        const path = `${this.getChannelPath(channel)}/mix/${(matrix + 22).toString().padStart(2, "0")}/level`;
        this.sendCommand(path, [level]);
    }

    // ========== Effect Type ==========

    async setEffectType(effect: number, type: number): Promise<void> {
        const path = `/fx/${effect.toString().padStart(2, "0")}/type`;
        this.sendCommand(path, [type]);
    }

    async getEffectType(effect: number): Promise<number> {
        const path = `/fx/${effect.toString().padStart(2, "0")}/type`;
        return await this.sendAndReceive(path);
    }

    // ========== More Dynamics Parameters ==========

    async setCompressorKnee(channel: number, knee: number): Promise<void> {
        // knee: 0.0 to 5.0 dB (0.0-1.0 range)
        const path = `${this.getChannelPath(channel)}/dyn/knee`;
        this.sendCommand(path, [knee]);
    }

    async setCompressorMakeupGain(channel: number, gain: number): Promise<void> {
        // gain: 0.0 to 24.0 dB (0.0-1.0 range)
        const path = `${this.getChannelPath(channel)}/dyn/mgain`;
        this.sendCommand(path, [gain]);
    }

    async setCompressorDetection(channel: number, detection: number): Promise<void> {
        // detection: 0=PEAK, 1=RMS
        const path = `${this.getChannelPath(channel)}/dyn/det`;
        this.sendCommand(path, [detection]);
    }

    async setCompressorEnv(channel: number, env: number): Promise<void> {
        // env: 0=LIN, 1=LOG
        const path = `${this.getChannelPath(channel)}/dyn/env`;
        this.sendCommand(path, [env]);
    }

    async setGateRange(channel: number, range: number): Promise<void> {
        // range: 0.0 to 80.0 dB (0.0-1.0 range)
        const path = `${this.getChannelPath(channel)}/gate/range`;
        this.sendCommand(path, [range]);
    }

    async setGateAttack(channel: number, attack: number): Promise<void> {
        // attack: 0.02ms to 2000ms (0.0-1.0 range)
        const path = `${this.getChannelPath(channel)}/gate/attack`;
        this.sendCommand(path, [attack]);
    }

    async setGateHold(channel: number, hold: number): Promise<void> {
        // hold: 5ms to 4000ms (0.0-1.0 range)
        const path = `${this.getChannelPath(channel)}/gate/hold`;
        this.sendCommand(path, [hold]);
    }

    async setGateRelease(channel: number, release: number): Promise<void> {
        // release: 5ms to 4000ms (0.0-1.0 range)
        const path = `${this.getChannelPath(channel)}/gate/release`;
        this.sendCommand(path, [release]);
    }

    // ========== Talkback ==========

    async setTalkback(enabled: boolean): Promise<void> {
        this.sendCommand("/-stat/talk", [enabled ? 1 : 0]);
    }

    async getTalkback(): Promise<boolean> {
        const value = await this.sendAndReceive("/-stat/talk");
        return value === 1;
    }

    // ========== Meters ==========
    // Note: Meters require subscription via /meters command and receive blob data
    // Implementation would require blob parsing - keeping simple for now

    async requestMeters(meterId: string, channelMeterId?: number, groupMeterId?: number, priority?: number): Promise<void> {
        const args: any[] = [meterId];
        if (channelMeterId !== undefined) args.push(channelMeterId);
        if (groupMeterId !== undefined) args.push(groupMeterId);
        if (priority !== undefined) args.push(priority);
        this.sendCommand("/meters", args);
    }

    // ========== Status ==========

    async getMixerStatus(): Promise<any> {
        try {
            const info = await this.sendAndReceive("/info");
            const status = await this.sendAndReceive("/status").catch(() => null);

            return {
                connected: true,
                host: this.host,
                port: this.port,
                info,
                status,
            };
        } catch (error) {
            return {
                connected: false,
                host: this.host,
                port: this.port,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // ========== Custom Commands ==========

    async sendCustomCommand(address: string, value?: any): Promise<void> {
        if (value === undefined) {
            this.sendCommand(address);
        } else {
            // osc-js automatically handles type conversion
            this.sendCommand(address, Array.isArray(value) ? value : [value]);
        }
    }

    close(): void {
        this.isConnected = false;
        this.osc.close();
    }
}
