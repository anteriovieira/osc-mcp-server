import { OSCClient } from "./dist/osc-client.js";

const OSC_HOST = process.env.OSC_HOST || "192.168.1.17";
const OSC_PORT = parseInt(process.env.OSC_PORT || "10023");

async function testGetAllChannelNames() {
    console.log("Testing getAllChannelNames...\n");

    const osc = new OSCClient(OSC_HOST, OSC_PORT);

    try {
        await osc.connect();
        console.log("✓ Connected to X32\n");

        console.log("Fetching all channel names...");
        const startTime = Date.now();
        const channels = await osc.getAllChannelNames();
        const endTime = Date.now();

        console.log(`✓ Fetched all ${channels.length} channel names in ${endTime - startTime}ms\n`);

        console.log("Channel | Name");
        console.log("--------|--------");
        for (const { channel, name } of channels) {
            console.log(`${channel.toString().padStart(2, ' ')}      | ${name}`);
        }

        osc.close();
        console.log("\n✓ Test completed successfully");
    } catch (error) {
        console.error("✗ Error:", error.message);
        osc.close();
        process.exit(1);
    }
}

testGetAllChannelNames();
