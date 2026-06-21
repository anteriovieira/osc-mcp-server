#!/usr/bin/env node

/**
 * Test script to verify OSC connection
 * Run with: node test-connection.js
 */

import { OSCClient } from "./dist/osc-client.js";

const OSC_HOST = process.env.OSC_HOST || "192.168.8.150";
const OSC_PORT = parseInt(process.env.OSC_PORT || "10024");

console.log("OSC Connection Test");
console.log("=".repeat(50));
console.log(`Host: ${OSC_HOST}`);
console.log(`Port: ${OSC_PORT}`);
console.log("=".repeat(50));

const osc = new OSCClient(OSC_HOST, OSC_PORT);

async function test() {
    try {
        console.log("\nConnecting to mixer...");
        await osc.connect();
        console.log("Connected successfully!");

        console.log("\nGetting mixer status...");
        const status = await osc.getMixerStatus();
        console.log("Status:", JSON.stringify(status, null, 2));

        if (status.connected && status.scene) {
            console.log(
                `\nScene: ${status.scene.index} "${status.scene.name}"`
            );
        }
        if (status.connected && status.main) {
            console.log(
                `Main: ${status.main.faderDb} dB, muted=${status.main.muted}`
            );
        }

        console.log("\nTesting fader control...");
        console.log("Getting channel 1 fader level...");
        try {
            const level = await osc.getFader(1);
            const db = OSCClient.levelToDb(level);
            console.log(
                `Channel 1 fader: ${(level * 100).toFixed(1)}% (${db} dB)`
            );
        } catch (error) {
            console.log(
                "Could not get fader level (this is normal if the mixer doesn't respond to queries)"
            );
        }

        console.log("\nGetting mixer overview (channels 1-2 only)...");
        const overviewStart = Date.now();
        try {
            const overview = await Promise.race([
                osc.getMixerOverview({
                    includeChannels: [1, 2],
                    includeBuses: [1],
                }),
                new Promise((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new Error(
                                    "Mixer overview timed out after 5 seconds"
                                )
                            ),
                        5000
                    )
                ),
            ]);
            console.log(`Overview fetched in ${Date.now() - overviewStart}ms`);
            console.log(
                "Overview sample:",
                JSON.stringify(overview, null, 2)
            );
        } catch (error) {
            console.log(
                `Overview failed after ${Date.now() - overviewStart}ms:`,
                error.message
            );
        }

        console.log("\nWaiting for meter cache (2s)...");
        await new Promise((r) => setTimeout(r, 2000));

        console.log("Getting meters (cache)...");
        try {
            const meters = await osc.getMeters({ mode: "cache" });
            console.log("Meters:", JSON.stringify(meters, null, 2));
        } catch (error) {
            console.log("Meters failed:", error.message);
        }

        console.log("\nAll tests completed!");
        console.log("\nYour mixer is ready to use with Claude Desktop!");
        console.log("\nNext steps:");
        console.log("1. Copy the configuration from claude_desktop_config.json");
        console.log("2. Add it to your Claude Desktop config file");
        console.log("3. Restart Claude Desktop");
        console.log("4. Start controlling your mixer with chat!");

    } catch (error) {
        console.error("\nConnection failed!");
        console.error("Error:", error.message);
        console.error("\nTroubleshooting:");
        console.error("1. Check that your mixer is powered on");
        console.error("2. Verify the IP address is correct");
        console.error("3. Ensure your computer and mixer are on the same network");
        console.error("4. Try pinging the mixer: ping " + OSC_HOST);
        console.error("5. Check firewall settings for UDP port " + OSC_PORT);
        process.exit(1);
    } finally {
        osc.close();
        process.exit(0);
    }
}

test();
