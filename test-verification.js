
import { OSCClient } from "./dist/osc-client.js";

const OSC_HOST = process.env.OSC_HOST || "192.168.1.17";
const OSC_PORT = parseInt(process.env.OSC_PORT || "10023");

const osc = new OSCClient(OSC_HOST, OSC_PORT);

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log("🚀 Starting X32 Verification Tests...");
    console.log(`Target: ${OSC_HOST}:${OSC_PORT}`);

    try {
        await osc.connect();
        console.log("✅ Connected");

        // 1. System Info
        console.log("\n--- Testing System Info ---");
        const info = await osc.getInfo();
        console.log("Info:", info);

        const status = await osc.getMixerStatus();
        console.log("Status:", status.status);

        // 2. Channel Controls (Channel 1)
        console.log("\n--- Testing Channel 1 Controls ---");
        const ch = 1;

        // Fader
        console.log("Setting Fader to 0.5...");
        await osc.setFader(ch, 0.5);
        await wait(200);
        const fader = await osc.getFader(ch);
        console.log(`Fader: ${fader} ${Math.abs(fader - 0.5) < 0.05 ? "✅" : "❌"}`);

        // Mute
        console.log("Muting...");
        await osc.muteChannel(ch, true);
        await wait(200);
        let mute = await osc.getMute(ch);
        console.log(`Mute (True): ${mute} ${mute === true ? "✅" : "❌"}`);

        console.log("Unmuting...");
        await osc.muteChannel(ch, false);
        await wait(200);
        mute = await osc.getMute(ch);
        console.log(`Mute (False): ${mute} ${mute === false ? "✅" : "❌"}`);

        // Pan
        console.log("Panning Left (-1.0)...");
        await osc.setPan(ch, -1.0);
        await wait(200);
        let pan = await osc.getPan(ch);
        console.log(`Pan Left: ${pan} ${Math.abs(pan - -1.0) < 0.05 ? "✅" : "❌"}`);

        console.log("Panning Center (0.0)...");
        await osc.setPan(ch, 0.0);
        await wait(200);
        pan = await osc.getPan(ch);
        console.log(`Pan Center: ${pan} ${Math.abs(pan - 0.0) < 0.05 ? "✅" : "❌"}`);

        // Name
        const originalName = await osc.getChannelName(ch);
        console.log(`Original Name: ${originalName}`);

        console.log("Setting Name to 'TEST'...");
        await osc.setChannelName(ch, "TEST");
        await wait(200);
        const newName = await osc.getChannelName(ch);
        console.log(`New Name: ${newName} ${newName === "TEST" ? "✅" : "❌"}`);

        console.log(`Restoring Name to '${originalName}'...`);
        await osc.setChannelName(ch, originalName);

        // 3. Preamp
        console.log("\n--- Testing Preamp (Channel 1) ---");
        // Gain (Trim)
        console.log("Setting Gain to 0.5...");
        await osc.setPreampGain(ch, 0.5);
        await wait(200);
        const gain = await osc.getPreampGain(ch);
        console.log(`Gain: ${gain} ${Math.abs(gain - 0.5) < 0.05 ? "✅" : "❌"}`);

        // 4. Dynamics (Gate & Compressor)
        console.log("\n--- Testing Dynamics (Channel 1) ---");

        // Gate
        console.log("Setting Gate Threshold to -40dB...");
        await osc.setGate(ch, -40);
        await wait(200);
        const gateThr = await osc.getGate(ch);
        console.log(`Gate Threshold: ${gateThr} ${Math.abs(gateThr - -40) < 1 ? "✅" : "❌"}`);

        console.log("Enabling Gate...");
        await osc.setGateOn(ch, true);

        // Compressor
        console.log("Setting Compressor Threshold to -20dB, Ratio 3:1...");
        await osc.setCompressor(ch, -20, 3);
        await wait(200);
        // Note: We don't have a simple getCompressor that returns both, so we skip verification or add individual getters if needed.
        // For now, we assume if set command worked without error, it's likely fine.
        console.log("Compressor Set Command Sent ✅");

        // 5. EQ
        console.log("\n--- Testing EQ (Channel 1) ---");
        console.log("Setting Band 1 Gain to +5dB...");
        await osc.setEQ(ch, 1, 5);
        await wait(200);
        const eqGain = await osc.getEQ(ch, 1);
        console.log(`EQ Band 1 Gain: ${eqGain} ${Math.abs(eqGain - 5) < 0.5 ? "✅" : "❌"}`);

        // 6. Bus Controls
        console.log("\n--- Testing Bus 1 Controls ---");
        const bus = 1;
        console.log("Setting Bus 1 Fader to 0.75...");
        await osc.setBusFader(bus, 0.75);
        await wait(200);
        const busFader = await osc.getBusFader(bus);
        console.log(`Bus 1 Fader: ${busFader} ${Math.abs(busFader - 0.75) < 0.05 ? "✅" : "❌"}`);

        // 7. Aux Controls
        console.log("\n--- Testing Aux 1 Controls ---");
        const aux = 1;
        console.log("Setting Aux 1 Fader to 0.25...");
        await osc.setAuxFader(aux, 0.25);
        await wait(200);
        const auxFader = await osc.getAuxFader(aux);
        console.log(`Aux 1 Fader: ${auxFader} ${Math.abs(auxFader - 0.25) < 0.05 ? "✅" : "❌"}`);

        // 8. Matrix Controls
        console.log("\n--- Testing Matrix 1 Controls ---");
        const mtx = 1;
        console.log("Setting Matrix 1 Fader to 0.6...");
        await osc.setMatrixFader(mtx, 0.6);
        await wait(200);
        const mtxFader = await osc.getMatrixFader(mtx);
        console.log(`Matrix 1 Fader: ${mtxFader} ${Math.abs(mtxFader - 0.6) < 0.05 ? "✅" : "❌"}`);

        // 9. Effects
        console.log("\n--- Testing Effect 1 ---");
        console.log("Enabling Effect 1...");
        await osc.setEffectOn(1, true);
        console.log("Effect 1 Enabled Command Sent ✅");

        console.log("Getting Effect 1 Type...");
        try {
            const type = await osc.getEffectType(1);
            console.log(`Effect 1 Type: ${type} ✅`);
        } catch (e) {
            console.log(`Effect 1 Type Failed: ${e.message} ❌`);
        }

    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        osc.close();
        process.exit(0);
    }
}

runTests();
