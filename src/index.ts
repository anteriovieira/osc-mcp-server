#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { OSCClient } from "./osc-client.js";

// Default OSC configuration (X-Air uses port 10024)
const OSC_HOST = process.env.OSC_HOST || "192.168.1.17";
const OSC_PORT = parseInt(process.env.OSC_PORT || "10024");

// Initialize OSC client
const osc = new OSCClient(OSC_HOST, OSC_PORT);

// Define available tools
const TOOLS: Tool[] = [
    // ========== Channel Controls ==========
    {
        name: "osc_set_fader",
        description: "Set the fader level for a channel (0.0 to 1.0)",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                level: {
                    type: "number",
                    description: "Fader level (0.0 = -∞dB, 0.75 = 0dB, 1.0 = +10dB)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "level"],
        },
    },
    {
        name: "osc_get_fader",
        description: "Get the current fader level for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
            },
            required: ["channel"],
        },
    },
    {
        name: "osc_mute_channel",
        description: "Mute or unmute a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                mute: {
                    type: "boolean",
                    description: "True to mute, false to unmute",
                },
            },
            required: ["channel", "mute"],
        },
    },
    {
        name: "osc_get_mute",
        description: "Get the mute status of a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
            },
            required: ["channel"],
        },
    },
    {
        name: "osc_set_pan",
        description: "Set the pan position for a channel (-1.0 = left, 0.0 = center, 1.0 = right)",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                pan: {
                    type: "number",
                    description: "Pan position (-1.0 to 1.0)",
                    minimum: -1,
                    maximum: 1,
                },
            },
            required: ["channel", "pan"],
        },
    },
    {
        name: "osc_get_pan",
        description: "Get the pan position for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
            },
            required: ["channel"],
        },
    },
    {
        name: "osc_set_channel_name",
        description: "Set the name of a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                name: {
                    type: "string",
                    description: "Channel name (max 6 characters)",
                },
            },
            required: ["channel", "name"],
        },
    },
    // ========== HPF / Low Cut (Preamp) ==========
    {
        name: "osc_set_hpf_on",
        description: "Enable or disable the high-pass filter (Low Cut) on a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                on: {
                    type: "boolean",
                    description: "True to enable Low Cut, false to disable",
                },
            },
            required: ["channel", "on"],
        },
    },
    {
        name: "osc_set_hpf",
        description: "Set the high-pass filter (Low Cut) frequency on a channel (20-400 Hz)",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                frequencyHz: {
                    type: "number",
                    description: "Cutoff frequency in Hz (20-400). ~80-100 Hz for male vocals, ~100-120 Hz for female vocals",
                    minimum: 20,
                    maximum: 400,
                },
            },
            required: ["channel", "frequencyHz"],
        },
    },
    {
        name: "osc_get_hpf",
        description: "Get the high-pass filter (Low Cut) frequency value from a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
            },
            required: ["channel"],
        },
    },
    {
        name: "osc_get_channel_name",
        description: "Get the name of a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
            },
            required: ["channel"],
        },
    },
    // ========== EQ Controls ==========
    {
        name: "osc_set_eq",
        description: "Set EQ gain for a channel band",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                band: {
                    type: "number",
                    description: "EQ band (1-4)",
                    minimum: 1,
                    maximum: 4,
                },
                gain: {
                    type: "number",
                    description: "Gain in dB (-15 to +15)",
                    minimum: -15,
                    maximum: 15,
                },
            },
            required: ["channel", "band", "gain"],
        },
    },
    {
        name: "osc_get_eq",
        description: "Get EQ gain for a channel band",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                band: {
                    type: "number",
                    description: "EQ band (1-4)",
                    minimum: 1,
                    maximum: 4,
                },
            },
            required: ["channel", "band"],
        },
    },
    {
        name: "osc_set_eq_frequency",
        description: "Set EQ frequency for a channel band",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                band: {
                    type: "number",
                    description: "EQ band (1-4)",
                    minimum: 1,
                    maximum: 4,
                },
                frequency: {
                    type: "number",
                    description: "Frequency in Hz",
                    minimum: 20,
                    maximum: 20000,
                },
            },
            required: ["channel", "band", "frequency"],
        },
    },
    {
        name: "osc_set_eq_q",
        description: "Set EQ Q factor for a channel band",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                band: {
                    type: "number",
                    description: "EQ band (1-4)",
                    minimum: 1,
                    maximum: 4,
                },
                q: {
                    type: "number",
                    description: "Q factor (0.1 to 10.0)",
                    minimum: 0.1,
                    maximum: 10,
                },
            },
            required: ["channel", "band", "q"],
        },
    },
    {
        name: "osc_set_eq_on",
        description: "Enable or disable EQ for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                on: {
                    type: "boolean",
                    description: "True to enable, false to disable",
                },
            },
            required: ["channel", "on"],
        },
    },
    // ========== Dynamics Controls ==========
    {
        name: "osc_set_gate",
        description: "Set gate threshold for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                threshold: {
                    type: "number",
                    description: "Gate threshold in dB (-80 to 0)",
                    minimum: -80,
                    maximum: 0,
                },
            },
            required: ["channel", "threshold"],
        },
    },
    {
        name: "osc_get_gate",
        description: "Get gate threshold for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
            },
            required: ["channel"],
        },
    },
    {
        name: "osc_set_gate_on",
        description: "Enable or disable gate for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                on: {
                    type: "boolean",
                    description: "True to enable, false to disable",
                },
            },
            required: ["channel", "on"],
        },
    },
    {
        name: "osc_set_compressor",
        description: "Set compressor threshold and ratio for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                threshold: {
                    type: "number",
                    description: "Compressor threshold in dB (-60 to 0)",
                    minimum: -60,
                    maximum: 0,
                },
                ratio: {
                    type: "number",
                    description: "Compression ratio (1.0 to 20.0)",
                    minimum: 1,
                    maximum: 20,
                },
            },
            required: ["channel", "threshold", "ratio"],
        },
    },
    {
        name: "osc_set_compressor_attack",
        description: "Set compressor attack time for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                attack: {
                    type: "number",
                    description: "Attack time (0.0 to 1.0)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "attack"],
        },
    },
    {
        name: "osc_set_compressor_release",
        description: "Set compressor release time for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                release: {
                    type: "number",
                    description: "Release time (0.0 to 1.0)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "release"],
        },
    },
    {
        name: "osc_set_compressor_on",
        description: "Enable or disable compressor for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                on: {
                    type: "boolean",
                    description: "True to enable, false to disable",
                },
            },
            required: ["channel", "on"],
        },
    },
    // ========== Bus Controls ==========
    {
        name: "osc_set_bus_fader",
        description: "Set the fader level for a mix bus",
        inputSchema: {
            type: "object",
            properties: {
                bus: {
                    type: "number",
                    description: "Bus number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
                level: {
                    type: "number",
                    description: "Fader level (0.0 to 1.0)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["bus", "level"],
        },
    },
    {
        name: "osc_get_bus_fader",
        description: "Get the fader level for a mix bus",
        inputSchema: {
            type: "object",
            properties: {
                bus: {
                    type: "number",
                    description: "Bus number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
            },
            required: ["bus"],
        },
    },
    {
        name: "osc_mute_bus",
        description: "Mute or unmute a mix bus",
        inputSchema: {
            type: "object",
            properties: {
                bus: {
                    type: "number",
                    description: "Bus number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
                mute: {
                    type: "boolean",
                    description: "True to mute, false to unmute",
                },
            },
            required: ["bus", "mute"],
        },
    },
    {
        name: "osc_set_bus_pan",
        description: "Set the pan position for a mix bus",
        inputSchema: {
            type: "object",
            properties: {
                bus: {
                    type: "number",
                    description: "Bus number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
                pan: {
                    type: "number",
                    description: "Pan position (-1.0 to 1.0)",
                    minimum: -1,
                    maximum: 1,
                },
            },
            required: ["bus", "pan"],
        },
    },
    {
        name: "osc_set_bus_name",
        description: "Set the name of a mix bus",
        inputSchema: {
            type: "object",
            properties: {
                bus: {
                    type: "number",
                    description: "Bus number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
                name: {
                    type: "string",
                    description: "Bus name (max 6 characters)",
                },
            },
            required: ["bus", "name"],
        },
    },
    // ========== Sends ==========
    {
        name: "osc_send_to_bus",
        description: "Set the send level from a channel to a mix bus",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                bus: {
                    type: "number",
                    description: "Mix bus number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
                level: {
                    type: "number",
                    description: "Send level (0.0 to 1.0)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "bus", "level"],
        },
    },
    {
        name: "osc_get_send_to_bus",
        description: "Get the send level from a channel to a mix bus",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                bus: {
                    type: "number",
                    description: "Mix bus number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
            },
            required: ["channel", "bus"],
        },
    },
    {
        name: "osc_send_to_fx",
        description:
            "Set the send level from a channel to an FX effect (1-4). FX 1-4 = buses 7-10. Level uses X-Air scale: 0.0=-∞dB, 0.75=0dB, 1.0=+10dB. Use levelDb for dB values (e.g. -20 for subtle reverb).",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                effect: {
                    type: "number",
                    description: "Effect number (1-4)",
                    minimum: 1,
                    maximum: 4,
                },
                level: {
                    type: "number",
                    description: "Send level 0.0-1.0 (0.75=0dB). Omit if using levelDb.",
                    minimum: 0,
                    maximum: 1,
                },
                levelDb: {
                    type: "number",
                    description: "Send level in dB (e.g. -20 for subtle). Takes precedence over level.",
                    minimum: -100,
                    maximum: 10,
                },
            },
            required: ["channel", "effect"],
        },
    },
    {
        name: "osc_get_send_to_fx",
        description: "Get the send level from a channel to an FX effect (1-4)",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                effect: {
                    type: "number",
                    description: "Effect number (1-4)",
                    minimum: 1,
                    maximum: 4,
                },
            },
            required: ["channel", "effect"],
        },
    },
    // ========== Main Mix ==========
    {
        name: "osc_set_main_fader",
        description: "Set the main LR fader level",
        inputSchema: {
            type: "object",
            properties: {
                level: {
                    type: "number",
                    description: "Fader level (0.0 to 1.0)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["level"],
        },
    },
    {
        name: "osc_get_main_fader",
        description: "Get the main LR fader level",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "osc_mute_main",
        description: "Mute or unmute the main LR mix",
        inputSchema: {
            type: "object",
            properties: {
                mute: {
                    type: "boolean",
                    description: "True to mute, false to unmute",
                },
            },
            required: ["mute"],
        },
    },
    {
        name: "osc_set_main_pan",
        description: "Set the pan position for the main LR mix",
        inputSchema: {
            type: "object",
            properties: {
                pan: {
                    type: "number",
                    description: "Pan position (-1.0 to 1.0)",
                    minimum: -1,
                    maximum: 1,
                },
            },
            required: ["pan"],
        },
    },
    // ========== Effects ==========
    {
        name: "osc_set_effect_on",
        description: "Enable or disable an effect",
        inputSchema: {
            type: "object",
            properties: {
                effect: {
                    type: "number",
                    description: "Effect number (1-4)",
                    minimum: 1,
                    maximum: 4,
                },
                on: {
                    type: "boolean",
                    description: "True to enable, false to disable",
                },
            },
            required: ["effect", "on"],
        },
    },
    {
        name: "osc_set_effect_mix",
        description: "Set the mix level for an effect",
        inputSchema: {
            type: "object",
            properties: {
                effect: {
                    type: "number",
                    description: "Effect number (1-4)",
                    minimum: 1,
                    maximum: 4,
                },
                mix: {
                    type: "number",
                    description: "Mix level (0.0 to 1.0)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["effect", "mix"],
        },
    },
    {
        name: "osc_set_effect_param",
        description: "Set a parameter value for an effect",
        inputSchema: {
            type: "object",
            properties: {
                effect: {
                    type: "number",
                    description: "Effect number (1-4)",
                    minimum: 1,
                    maximum: 4,
                },
                param: {
                    type: "number",
                    description: "Parameter number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                value: {
                    type: "number",
                    description: "Parameter value (0.0 to 1.0)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["effect", "param", "value"],
        },
    },
    // ========== Routing ==========
    {
        name: "osc_set_channel_source",
        description: "Set the input source for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                source: {
                    type: "number",
                    description: "Source number (0-15 for X-Air input sources)",
                    minimum: 0,
                    maximum: 15,
                },
            },
            required: ["channel", "source"],
        },
    },
    {
        name: "osc_get_channel_source",
        description: "Get the input source for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
            },
            required: ["channel"],
        },
    },
    // ========== Scenes ==========
    {
        name: "osc_scene_recall",
        description: "Recall a saved scene",
        inputSchema: {
            type: "object",
            properties: {
                scene: {
                    type: "number",
                    description: "Scene number (1-64)",
                    minimum: 1,
                    maximum: 64,
                },
            },
            required: ["scene"],
        },
    },
    {
        name: "osc_scene_save",
        description: "Save the current mixer state as a scene",
        inputSchema: {
            type: "object",
            properties: {
                scene: {
                    type: "number",
                    description: "Scene number (1-64)",
                    minimum: 1,
                    maximum: 64,
                },
                name: {
                    type: "string",
                    description: "Scene name (optional)",
                },
            },
            required: ["scene"],
        },
    },
    {
        name: "osc_get_scene_name",
        description: "Get the name of a saved scene",
        inputSchema: {
            type: "object",
            properties: {
                scene: {
                    type: "number",
                    description: "Scene number (1-64)",
                    minimum: 1,
                    maximum: 64,
                },
            },
            required: ["scene"],
        },
    },
    // ========== Mixer read / overview ==========
    {
        name: "osc_get_mixer_overview",
        description:
            "Get a compact snapshot of mixer state: scene, main, channels, and buses in one call. Prefer this before making bulk changes.",
        inputSchema: {
            type: "object",
            properties: {
                includeChannels: {
                    description:
                        "Include channels: true (all 16), false, or array of channel numbers 1-16",
                },
                includeBuses: {
                    description:
                        "Include buses: true (all 6), false, or array of bus numbers 1-6",
                },
                includeSends: {
                    type: "boolean",
                    description: "Include channel-to-bus send matrix (default false)",
                },
                includeDynamics: {
                    type: "boolean",
                    description:
                        "Include EQ/gate/compressor summary per channel (default false)",
                },
            },
        },
    },
    {
        name: "osc_get_channel_detail",
        description:
            "Deep read of one channel: fader, HPF, EQ, dynamics, bus/FX sends. Use for soundcheck or troubleshooting.",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
            },
            required: ["channel"],
        },
    },
    {
        name: "osc_get_meters",
        description:
            "Get live signal levels in dB. mode=cache (instant, default) or snapshot (fresh reading). Returns input and mix meters plus hot/silent channel lists.",
        inputSchema: {
            type: "object",
            properties: {
                mode: {
                    type: "string",
                    enum: ["cache", "snapshot"],
                    description: "cache = latest background reading; snapshot = wait for fresh update",
                },
                groups: {
                    type: "array",
                    items: { type: "string", enum: ["input", "mix"] },
                    description: 'Meter groups: "input" (/meters/2), "mix" (/meters/1). Default both.',
                },
            },
        },
    },
    // ========== Composite Workflows ==========
    {
        name: "osc_apply_channel_preset",
        description:
            "Apply a named preset (HPF, EQ, compressor, optional FX send) to one channel in a single call. Presets: vocal, bass, acoustic-guitar, electric-guitar-forro, percussion.",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    oneOf: [
                        { type: "number", minimum: 1, maximum: 16 },
                        { type: "string" },
                    ],
                    description:
                        "Channel number (1-16) or name (case-insensitive match from mixer)",
                },
                preset: {
                    type: "string",
                    enum: [
                        "vocal",
                        "bass",
                        "acoustic-guitar",
                        "electric-guitar-forro",
                        "percussion",
                    ],
                    description: "Named channel preset to apply",
                },
                dryRun: {
                    type: "boolean",
                    description:
                        "If true, return planned changes without applying to the mixer",
                },
            },
            required: ["channel", "preset"],
        },
    },
    {
        name: "osc_mute_all_except",
        description:
            "Mute all channels except the listed ones (by number or name). Use for solo workflows.",
        inputSchema: {
            type: "object",
            properties: {
                channels: {
                    type: "array",
                    items: {
                        oneOf: [
                            { type: "number", minimum: 1, maximum: 16 },
                            { type: "string" },
                        ],
                    },
                    description:
                        "Channels to keep unmuted (numbers or names, e.g. [5, \"Guitar\"])",
                },
                includeMain: {
                    type: "boolean",
                    description:
                        "If true, also ensure main LR is unmuted (default: leave main untouched)",
                },
                dryRun: {
                    type: "boolean",
                    description:
                        "If true, return planned changes without applying to the mixer",
                },
            },
            required: ["channels"],
        },
    },
    {
        name: "osc_soundcheck_channel",
        description:
            "Read one channel end-to-end: fader, mute, pan, HPF, EQ, dynamics, sends, and input/mix meter levels in one JSON report.",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    oneOf: [
                        { type: "number", minimum: 1, maximum: 16 },
                        { type: "string" },
                    ],
                    description:
                        "Channel number (1-16) or name (case-insensitive match from mixer)",
                },
            },
            required: ["channel"],
        },
    },
    {
        name: "osc_setup_monitor_mix",
        description:
            "Configure a bus as a monitor mix: set bus name, bus fader, and send levels from listed channels.",
        inputSchema: {
            type: "object",
            properties: {
                bus: {
                    type: "number",
                    minimum: 1,
                    maximum: 6,
                    description: "Bus number (1-6)",
                },
                name: {
                    type: "string",
                    description: "Name for the monitor bus",
                },
                channels: {
                    type: "array",
                    description:
                        "Channels to send to the bus (number, name, or object with channel + optional level/levelDb)",
                    items: {},
                },
                busFader: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Bus fader level (default 0.75 = 0 dB)",
                },
                dryRun: {
                    type: "boolean",
                    description:
                        "If true, return planned changes without applying to the mixer",
                },
            },
            required: ["bus", "name", "channels"],
        },
    },
    // ========== Status ==========
    {
        name: "osc_get_mixer_status",
        description:
            "Get mixer connection info, current scene, and main fader/mute state",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    // ========== Custom Commands ==========
    {
        name: "osc_custom_command",
        description: "Send a custom OSC command to the mixer",
        inputSchema: {
            type: "object",
            properties: {
                address: {
                    type: "string",
                    description: "OSC address (e.g., /ch/01/mix/fader)",
                },
                value: {
                    description: "Value to send (number, string, or array)",
                },
            },
            required: ["address"],
        },
    },
];

// Create MCP server
const server = new Server(
    {
        name: "osc-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            // ========== Channel Controls ==========
            case "osc_set_fader": {
                const { channel, level } = args as { channel: number; level: number };
                await osc.setFader(channel, level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} fader to ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_get_fader": {
                const { channel } = args as { channel: number };
                const level = await osc.getFader(channel);
                const db = OSCClient.levelToDb(level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} fader is at ${(level * 100).toFixed(1)}% (${db} dB)`,
                        },
                    ],
                };
            }

            case "osc_mute_channel": {
                const { channel, mute } = args as { channel: number; mute: boolean };
                await osc.muteChannel(channel, mute);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} ${mute ? "muted" : "unmuted"}`,
                        },
                    ],
                };
            }

            case "osc_get_mute": {
                const { channel } = args as { channel: number };
                const mute = await osc.getMute(channel);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} is ${mute ? "muted" : "unmuted"}`,
                        },
                    ],
                };
            }

            case "osc_set_pan": {
                const { channel, pan } = args as { channel: number; pan: number };
                await osc.setPan(channel, pan);
                const panText =
                    pan < -0.1 ? "left" : pan > 0.1 ? "right" : "center";
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} pan to ${panText} (${pan.toFixed(2)})`,
                        },
                    ],
                };
            }

            case "osc_get_pan": {
                const { channel } = args as { channel: number };
                const pan = await osc.getPan(channel);
                const panText =
                    pan < -0.1 ? "left" : pan > 0.1 ? "right" : "center";
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} pan is ${panText} (${pan.toFixed(2)})`,
                        },
                    ],
                };
            }

            case "osc_set_channel_name": {
                const { channel, name } = args as { channel: number; name: string };
                await osc.setChannelName(channel, name);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} name to "${name}"`,
                        },
                    ],
                };
            }

            case "osc_get_channel_name": {
                const { channel } = args as { channel: number };
                const name = await osc.getChannelName(channel);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} name is "${name}"`,
                        },
                    ],
                };
            }

            case "osc_set_hpf_on": {
                const { channel, on } = args as { channel: number; on: boolean };
                await osc.setHPFOn(channel, on);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} Low Cut (HPF) ${on ? "enabled" : "disabled"}`,
                        },
                    ],
                };
            }

            case "osc_set_hpf": {
                const { channel, frequencyHz } = args as {
                    channel: number;
                    frequencyHz: number;
                };
                await osc.setHPF(channel, frequencyHz);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} Low Cut (HPF) to ${frequencyHz} Hz`,
                        },
                    ],
                };
            }

            case "osc_get_hpf": {
                const { channel } = args as { channel: number };
                const hz = await osc.getHPFHz(channel);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} Low Cut (HPF) is at ${Math.round(hz)} Hz`,
                        },
                    ],
                };
            }

            // ========== EQ Controls ==========
            case "osc_set_eq": {
                const { channel, band, gain } = args as {
                    channel: number;
                    band: number;
                    gain: number;
                };
                await osc.setEQ(channel, band, gain);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} EQ band ${band} to ${gain > 0 ? "+" : ""}${gain}dB`,
                        },
                    ],
                };
            }

            case "osc_get_eq": {
                const { channel, band } = args as { channel: number; band: number };
                const gain = await osc.getEQ(channel, band);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} EQ band ${band} is at ${gain > 0 ? "+" : ""}${gain.toFixed(1)}dB`,
                        },
                    ],
                };
            }

            case "osc_set_eq_frequency": {
                const { channel, band, frequency } = args as {
                    channel: number;
                    band: number;
                    frequency: number;
                };
                await osc.setEQFrequency(channel, band, frequency);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} EQ band ${band} frequency to ${frequency}Hz`,
                        },
                    ],
                };
            }

            case "osc_set_eq_q": {
                const { channel, band, q } = args as {
                    channel: number;
                    band: number;
                    q: number;
                };
                await osc.setEQQ(channel, band, q);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} EQ band ${band} Q to ${q.toFixed(2)}`,
                        },
                    ],
                };
            }

            case "osc_set_eq_on": {
                const { channel, on } = args as { channel: number; on: boolean };
                await osc.setEQOn(channel, on);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} EQ ${on ? "enabled" : "disabled"}`,
                        },
                    ],
                };
            }

            // ========== Dynamics Controls ==========
            case "osc_set_gate": {
                const { channel, threshold } = args as {
                    channel: number;
                    threshold: number;
                };
                await osc.setGate(channel, threshold);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} gate threshold to ${threshold}dB`,
                        },
                    ],
                };
            }

            case "osc_get_gate": {
                const { channel } = args as { channel: number };
                const threshold = await osc.getGate(channel);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} gate threshold is ${threshold.toFixed(1)}dB`,
                        },
                    ],
                };
            }

            case "osc_set_gate_on": {
                const { channel, on } = args as { channel: number; on: boolean };
                await osc.setGateOn(channel, on);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} gate ${on ? "enabled" : "disabled"}`,
                        },
                    ],
                };
            }

            case "osc_set_compressor": {
                const { channel, threshold, ratio } = args as {
                    channel: number;
                    threshold: number;
                    ratio: number;
                };
                await osc.setCompressor(channel, threshold, ratio);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} compressor: ${threshold}dB threshold, ${ratio}:1 ratio`,
                        },
                    ],
                };
            }

            case "osc_set_compressor_attack": {
                const { channel, attack } = args as {
                    channel: number;
                    attack: number;
                };
                await osc.setCompressorAttack(channel, attack);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} compressor attack to ${(attack * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_set_compressor_release": {
                const { channel, release } = args as {
                    channel: number;
                    release: number;
                };
                await osc.setCompressorRelease(channel, release);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} compressor release to ${(release * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_set_compressor_on": {
                const { channel, on } = args as { channel: number; on: boolean };
                await osc.setCompressorOn(channel, on);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} compressor ${on ? "enabled" : "disabled"}`,
                        },
                    ],
                };
            }

            // ========== Bus Controls ==========
            case "osc_set_bus_fader": {
                const { bus, level } = args as { bus: number; level: number };
                await osc.setBusFader(bus, level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set bus ${bus} fader to ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_get_bus_fader": {
                const { bus } = args as { bus: number };
                const level = await osc.getBusFader(bus);
                const db = OSCClient.levelToDb(level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Bus ${bus} fader is at ${(level * 100).toFixed(1)}% (${db} dB)`,
                        },
                    ],
                };
            }

            case "osc_mute_bus": {
                const { bus, mute } = args as { bus: number; mute: boolean };
                await osc.muteBus(bus, mute);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Bus ${bus} ${mute ? "muted" : "unmuted"}`,
                        },
                    ],
                };
            }

            case "osc_set_bus_pan": {
                const { bus, pan } = args as { bus: number; pan: number };
                await osc.setBusPan(bus, pan);
                const panText =
                    pan < -0.1 ? "left" : pan > 0.1 ? "right" : "center";
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set bus ${bus} pan to ${panText} (${pan.toFixed(2)})`,
                        },
                    ],
                };
            }

            case "osc_set_bus_name": {
                const { bus, name } = args as { bus: number; name: string };
                await osc.setBusName(bus, name);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set bus ${bus} name to "${name}"`,
                        },
                    ],
                };
            }

            // ========== Sends ==========
            case "osc_send_to_bus": {
                const { channel, bus, level } = args as {
                    channel: number;
                    bus: number;
                    level: number;
                };
                await osc.sendToBus(channel, bus, level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} send to bus ${bus} at ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_get_send_to_bus": {
                const { channel, bus } = args as {
                    channel: number;
                    bus: number;
                };
                const level = await osc.getSendToBus(channel, bus);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} send to bus ${bus} is at ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_send_to_fx": {
                const { channel, effect, level, levelDb } = args as {
                    channel: number;
                    effect: number;
                    level?: number;
                    levelDb?: number;
                };
                const sendLevel =
                    levelDb !== undefined
                        ? OSCClient.dbToLevel(levelDb)
                        : level ?? 0;
                await osc.sendToFx(channel, effect, sendLevel);
                const dbText =
                    levelDb !== undefined
                        ? `${levelDb} dB`
                        : `${(sendLevel * 100).toFixed(1)}%`;
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} send to FX ${effect} at ${dbText}`,
                        },
                    ],
                };
            }

            case "osc_get_send_to_fx": {
                const { channel, effect } = args as {
                    channel: number;
                    effect: number;
                };
                const level = await osc.getSendToFx(channel, effect);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} send to FX ${effect} is at ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            // ========== Main Mix ==========
            case "osc_set_main_fader": {
                const { level } = args as { level: number };
                await osc.setMainFader(level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set main LR fader to ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_get_main_fader": {
                const level = await osc.getMainFader();
                const db = OSCClient.levelToDb(level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Main LR fader is at ${(level * 100).toFixed(1)}% (${db} dB)`,
                        },
                    ],
                };
            }

            case "osc_mute_main": {
                const { mute } = args as { mute: boolean };
                await osc.muteMain(mute);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Main LR mix ${mute ? "muted" : "unmuted"}`,
                        },
                    ],
                };
            }

            case "osc_set_main_pan": {
                const { pan } = args as { pan: number };
                await osc.setMainPan(pan);
                const panText =
                    pan < -0.1 ? "left" : pan > 0.1 ? "right" : "center";
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set main LR pan to ${panText} (${pan.toFixed(2)})`,
                        },
                    ],
                };
            }

            // ========== Effects ==========
            case "osc_set_effect_on": {
                const { effect, on } = args as {
                    effect: number;
                    on: boolean;
                };
                await osc.setEffectOn(effect, on);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Effect ${effect} ${on ? "enabled" : "disabled"}`,
                        },
                    ],
                };
            }

            case "osc_set_effect_mix": {
                const { effect, mix } = args as {
                    effect: number;
                    mix: number;
                };
                await osc.setEffectMix(effect, mix);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set effect ${effect} mix to ${(mix * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_set_effect_param": {
                const { effect, param, value } = args as {
                    effect: number;
                    param: number;
                    value: number;
                };
                await osc.setEffectParam(effect, param, value);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set effect ${effect} parameter ${param} to ${(value * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            // ========== Routing ==========
            case "osc_set_channel_source": {
                const { channel, source } = args as {
                    channel: number;
                    source: number;
                };
                await osc.setChannelSource(channel, source);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} source to ${source}`,
                        },
                    ],
                };
            }

            case "osc_get_channel_source": {
                const { channel } = args as { channel: number };
                const source = await osc.getChannelSource(channel);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} source is ${source}`,
                        },
                    ],
                };
            }

            // ========== Scenes ==========
            case "osc_scene_recall": {
                const { scene } = args as { scene: number };
                await osc.recallScene(scene);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Recalled scene ${scene}`,
                        },
                    ],
                };
            }

            case "osc_scene_save": {
                const { scene, name } = args as {
                    scene: number;
                    name?: string;
                };
                await osc.saveScene(scene, name);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Saved scene ${scene}${name ? ` as "${name}"` : ""}`,
                        },
                    ],
                };
            }

            case "osc_get_scene_name": {
                const { scene } = args as { scene: number };
                const name = await osc.getSceneName(scene);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Scene ${scene} name is "${name}"`,
                        },
                    ],
                };
            }

            // ========== Mixer read / overview ==========
            case "osc_get_mixer_overview": {
                const {
                    includeChannels,
                    includeBuses,
                    includeSends,
                    includeDynamics,
                } = args as {
                    includeChannels?: boolean | number[] | "all";
                    includeBuses?: boolean | number[] | "all";
                    includeSends?: boolean;
                    includeDynamics?: boolean;
                };
                const overview = await osc.getMixerOverview({
                    includeChannels,
                    includeBuses,
                    includeSends,
                    includeDynamics,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(overview, null, 2),
                        },
                    ],
                };
            }

            case "osc_get_channel_detail": {
                const { channel } = args as { channel: number };
                const detail = await osc.getChannelDetail(channel);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(detail, null, 2),
                        },
                    ],
                };
            }

            case "osc_get_meters": {
                const { mode, groups } = args as {
                    mode?: "cache" | "snapshot";
                    groups?: ("input" | "mix")[];
                };
                const meters = await osc.getMeters({ mode, groups });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(meters, null, 2),
                        },
                    ],
                };
            }

            // ========== Composite Workflows ==========
            case "osc_apply_channel_preset": {
                const { channel, preset, dryRun } = args as {
                    channel: number | string;
                    preset: string;
                    dryRun?: boolean;
                };
                const result = await osc.applyChannelPreset(channel, preset, {
                    dryRun,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            case "osc_mute_all_except": {
                const { channels, includeMain, dryRun } = args as {
                    channels: (number | string)[];
                    includeMain?: boolean;
                    dryRun?: boolean;
                };
                const result = await osc.muteAllExcept(channels, {
                    includeMain,
                    dryRun,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            case "osc_soundcheck_channel": {
                const { channel } = args as { channel: number | string };
                const result = await osc.soundcheckChannel(channel);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            case "osc_setup_monitor_mix": {
                const { bus, name, channels, busFader, dryRun } = args as {
                    bus: number;
                    name: string;
                    channels: Array<
                        | number
                        | string
                        | {
                              channel: number | string;
                              level?: number;
                              levelDb?: number;
                          }
                    >;
                    busFader?: number;
                    dryRun?: boolean;
                };
                const result = await osc.setupMonitorMix(bus, name, channels, {
                    busFader,
                    dryRun,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            // ========== Status ==========
            case "osc_get_mixer_status": {
                const status = await osc.getMixerStatus();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Mixer Status:\n${JSON.stringify(status, null, 2)}`,
                        },
                    ],
                };
            }

            // ========== Custom Commands ==========
            case "osc_custom_command": {
                const { address, value } = args as {
                    address: string;
                    value?: any;
                };
                await osc.sendCustomCommand(address, value);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Sent OSC command to ${address}${value !== undefined ? ` with value ${JSON.stringify(value)}` : ""}`,
                        },
                    ],
                };
            }

            default:
                return {
                    content: [
                        {
                            type: "text",
                            text: `Unknown tool: ${name}`,
                        },
                    ],
                    isError: true,
                };
        }
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
});

// Start server
async function main() {
    console.error("Starting OSC MCP Server...");
    console.error(`Connecting to OSC device at ${OSC_HOST}:${OSC_PORT}`);

    await osc.connect();

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("OSC MCP Server running");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
