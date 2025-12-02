#!/usr/bin/env node

import { exec, spawn } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { OSCClient } from "./osc-client.js";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default OSC configuration
const OSC_HOST = process.env.OSC_HOST || "192.168.1.17";
const OSC_PORT = parseInt(process.env.OSC_PORT || "10023");

// Initialize OSC client
const osc = new OSCClient(OSC_HOST, OSC_PORT);

// Emulator process management
let emulatorProcess: ReturnType<typeof spawn> | null = null;
let emulatorPid: number | null = null;

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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                name: {
                    type: "string",
                    description: "Channel name (max 6 characters)",
                },
            },
            required: ["channel", "name"],
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                band: {
                    type: "number",
                    description: "EQ band (1-6)",
                    minimum: 1,
                    maximum: 6,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                band: {
                    type: "number",
                    description: "EQ band (1-6)",
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                band: {
                    type: "number",
                    description: "EQ band (1-6)",
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                band: {
                    type: "number",
                    description: "EQ band (1-6)",
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Bus number (1-16)",
                    minimum: 1,
                    maximum: 16,
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
                    description: "Bus number (1-16)",
                    minimum: 1,
                    maximum: 16,
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
                    description: "Bus number (1-16)",
                    minimum: 1,
                    maximum: 16,
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
                    description: "Bus number (1-16)",
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
                    description: "Bus number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
                name: {
                    type: "string",
                    description: "Bus name (max 6 characters)",
                },
            },
            required: ["bus", "name"],
        },
    },
    // ========== Aux Controls ==========
    {
        name: "osc_set_aux_fader",
        description: "Set the fader level for an aux output",
        inputSchema: {
            type: "object",
            properties: {
                aux: {
                    type: "number",
                    description: "Aux number (1-6)",
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
            required: ["aux", "level"],
        },
    },
    {
        name: "osc_get_aux_fader",
        description: "Get the fader level for an aux output",
        inputSchema: {
            type: "object",
            properties: {
                aux: {
                    type: "number",
                    description: "Aux number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
            },
            required: ["aux"],
        },
    },
    {
        name: "osc_mute_aux",
        description: "Mute or unmute an aux output",
        inputSchema: {
            type: "object",
            properties: {
                aux: {
                    type: "number",
                    description: "Aux number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
                mute: {
                    type: "boolean",
                    description: "True to mute, false to unmute",
                },
            },
            required: ["aux", "mute"],
        },
    },
    {
        name: "osc_set_aux_pan",
        description: "Set the pan position for an aux output",
        inputSchema: {
            type: "object",
            properties: {
                aux: {
                    type: "number",
                    description: "Aux number (1-6)",
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
            required: ["aux", "pan"],
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                bus: {
                    type: "number",
                    description: "Mix bus number (1-16)",
                    minimum: 1,
                    maximum: 16,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                bus: {
                    type: "number",
                    description: "Mix bus number (1-16)",
                    minimum: 1,
                    maximum: 16,
                },
            },
            required: ["channel", "bus"],
        },
    },
    {
        name: "osc_send_to_aux",
        description: "Set the send level from a channel to an aux output",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                aux: {
                    type: "number",
                    description: "Aux number (1-6)",
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
            required: ["channel", "aux", "level"],
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
    // ========== Matrix ==========
    {
        name: "osc_set_matrix_fader",
        description: "Set the fader level for a matrix output",
        inputSchema: {
            type: "object",
            properties: {
                matrix: {
                    type: "number",
                    description: "Matrix number (1-6)",
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
            required: ["matrix", "level"],
        },
    },
    {
        name: "osc_mute_matrix",
        description: "Mute or unmute a matrix output",
        inputSchema: {
            type: "object",
            properties: {
                matrix: {
                    type: "number",
                    description: "Matrix number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
                mute: {
                    type: "boolean",
                    description: "True to mute, false to unmute",
                },
            },
            required: ["matrix", "mute"],
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
                    description: "Effect number (1-8)",
                    minimum: 1,
                    maximum: 8,
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
                    description: "Effect number (1-8)",
                    minimum: 1,
                    maximum: 8,
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
                    description: "Effect number (1-8)",
                    minimum: 1,
                    maximum: 8,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                source: {
                    type: "number",
                    description: "Source number (0-63)",
                    minimum: 0,
                    maximum: 63,
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
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
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
                    description: "Scene number (1-100)",
                    minimum: 1,
                    maximum: 100,
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
                    description: "Scene number (1-100)",
                    minimum: 1,
                    maximum: 100,
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
                    description: "Scene number (1-100)",
                    minimum: 1,
                    maximum: 100,
                },
            },
            required: ["scene"],
        },
    },
    // ========== System Commands ==========
    {
        name: "osc_get_info",
        description: "Get mixer information (server version, name, console model, version)",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "osc_enable_xcontrol",
        description: "Enable XControl mode to receive parameter updates from mixer (timeout: 10 seconds)",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    // ========== Preamp Controls ==========
    {
        name: "osc_set_preamp_gain",
        description: "Set preamp gain for a channel (headamp trim)",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                gain: {
                    type: "number",
                    description: "Gain level (0.0 to 1.0, representing -12dB to +60dB)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "gain"],
        },
    },
    {
        name: "osc_get_preamp_gain",
        description: "Get preamp gain for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
            },
            required: ["channel"],
        },
    },
    {
        name: "osc_set_highpass_filter",
        description: "Enable or disable high-pass filter for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                enabled: {
                    type: "boolean",
                    description: "True to enable, false to disable",
                },
            },
            required: ["channel", "enabled"],
        },
    },
    {
        name: "osc_set_highpass_filter_frequency",
        description: "Set high-pass filter frequency for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                frequency: {
                    type: "number",
                    description: "Frequency level (0.0 to 1.0, representing 20Hz to 400Hz)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "frequency"],
        },
    },
    {
        name: "osc_set_phantom_power",
        description: "Set phantom power for a headamp",
        inputSchema: {
            type: "object",
            properties: {
                headamp: {
                    type: "number",
                    description: "Headamp number (0-127: 0-31=local, 32-79=AES50-A, 80-127=AES50-B)",
                    minimum: 0,
                    maximum: 127,
                },
                enabled: {
                    type: "boolean",
                    description: "True to enable, false to disable",
                },
            },
            required: ["headamp", "enabled"],
        },
    },
    // ========== Insert Effects ==========
    {
        name: "osc_set_insert_on",
        description: "Enable or disable insert effect for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                enabled: {
                    type: "boolean",
                    description: "True to enable, false to disable",
                },
            },
            required: ["channel", "enabled"],
        },
    },
    {
        name: "osc_set_insert_position",
        description: "Set insert effect position for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                position: {
                    type: "number",
                    description: "Position: 0=PRE, 1=POST (or 0-3 based on protocol)",
                    minimum: 0,
                    maximum: 3,
                },
            },
            required: ["channel", "position"],
        },
    },
    // ========== Solo Controls ==========
    {
        name: "osc_set_solo",
        description: "Solo or unsolo a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                solo: {
                    type: "boolean",
                    description: "True to solo, false to unsolo",
                },
            },
            required: ["channel", "solo"],
        },
    },
    {
        name: "osc_get_solo",
        description: "Get solo status of a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
            },
            required: ["channel"],
        },
    },
    // ========== DCA Groups ==========
    {
        name: "osc_set_dca_on",
        description: "Enable or disable a DCA group",
        inputSchema: {
            type: "object",
            properties: {
                dca: {
                    type: "number",
                    description: "DCA number (1-8)",
                    minimum: 1,
                    maximum: 8,
                },
                on: {
                    type: "boolean",
                    description: "True to enable, false to disable",
                },
            },
            required: ["dca", "on"],
        },
    },
    {
        name: "osc_set_dca_fader",
        description: "Set the fader level for a DCA group",
        inputSchema: {
            type: "object",
            properties: {
                dca: {
                    type: "number",
                    description: "DCA number (1-8)",
                    minimum: 1,
                    maximum: 8,
                },
                level: {
                    type: "number",
                    description: "Fader level (0.0 to 1.0)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["dca", "level"],
        },
    },
    {
        name: "osc_get_dca_fader",
        description: "Get the fader level for a DCA group",
        inputSchema: {
            type: "object",
            properties: {
                dca: {
                    type: "number",
                    description: "DCA number (1-8)",
                    minimum: 1,
                    maximum: 8,
                },
            },
            required: ["dca"],
        },
    },
    {
        name: "osc_set_dca_name",
        description: "Set the name of a DCA group",
        inputSchema: {
            type: "object",
            properties: {
                dca: {
                    type: "number",
                    description: "DCA number (1-8)",
                    minimum: 1,
                    maximum: 8,
                },
                name: {
                    type: "string",
                    description: "DCA name",
                },
            },
            required: ["dca", "name"],
        },
    },
    // ========== Output Controls ==========
    {
        name: "osc_set_output_source",
        description: "Set the source for an output (main, aux, p16, aes, rec)",
        inputSchema: {
            type: "object",
            properties: {
                outputType: {
                    type: "string",
                    description: "Output type: main, aux, p16, aes, or rec",
                    enum: ["main", "aux", "p16", "aes", "rec"],
                },
                output: {
                    type: "number",
                    description: "Output number (1-16 for main/p16, 1-6 for aux, 1-2 for aes/rec)",
                    minimum: 1,
                    maximum: 16,
                },
                source: {
                    type: "number",
                    description: "Source number (0-76)",
                    minimum: 0,
                    maximum: 76,
                },
            },
            required: ["outputType", "output", "source"],
        },
    },
    {
        name: "osc_set_output_delay",
        description: "Enable or disable delay for an output",
        inputSchema: {
            type: "object",
            properties: {
                outputType: {
                    type: "string",
                    description: "Output type: main, aux, p16, aes, or rec",
                    enum: ["main", "aux", "p16", "aes", "rec"],
                },
                output: {
                    type: "number",
                    description: "Output number",
                    minimum: 1,
                    maximum: 16,
                },
                enabled: {
                    type: "boolean",
                    description: "True to enable, false to disable",
                },
            },
            required: ["outputType", "output", "enabled"],
        },
    },
    {
        name: "osc_set_output_delay_time",
        description: "Set delay time for an output",
        inputSchema: {
            type: "object",
            properties: {
                outputType: {
                    type: "string",
                    description: "Output type: main, aux, p16, aes, or rec",
                    enum: ["main", "aux", "p16", "aes", "rec"],
                },
                output: {
                    type: "number",
                    description: "Output number",
                    minimum: 1,
                    maximum: 16,
                },
                time: {
                    type: "number",
                    description: "Delay time (0.0 to 1.0, representing 0.3ms to 500ms)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["outputType", "output", "time"],
        },
    },
    // ========== Main Mono ==========
    {
        name: "osc_set_main_mono_fader",
        description: "Set the main mono fader level",
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
        name: "osc_get_main_mono_fader",
        description: "Get the main mono fader level",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "osc_mute_main_mono",
        description: "Mute or unmute the main mono mix",
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
    // ========== Matrix Controls ==========
    {
        name: "osc_set_matrix_name",
        description: "Set the name of a matrix output",
        inputSchema: {
            type: "object",
            properties: {
                matrix: {
                    type: "number",
                    description: "Matrix number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
                name: {
                    type: "string",
                    description: "Matrix name",
                },
            },
            required: ["matrix", "name"],
        },
    },
    {
        name: "osc_get_matrix_name",
        description: "Get the name of a matrix output",
        inputSchema: {
            type: "object",
            properties: {
                matrix: {
                    type: "number",
                    description: "Matrix number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
            },
            required: ["matrix"],
        },
    },
    {
        name: "osc_get_matrix_fader",
        description: "Get the fader level for a matrix output",
        inputSchema: {
            type: "object",
            properties: {
                matrix: {
                    type: "number",
                    description: "Matrix number (1-6)",
                    minimum: 1,
                    maximum: 6,
                },
            },
            required: ["matrix"],
        },
    },
    {
        name: "osc_send_to_matrix",
        description: "Set the send level from a channel to a matrix output",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                matrix: {
                    type: "number",
                    description: "Matrix number (1-6)",
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
            required: ["channel", "matrix", "level"],
        },
    },
    // ========== Effect Type ==========
    {
        name: "osc_set_effect_type",
        description: "Set the effect type for an effect slot",
        inputSchema: {
            type: "object",
            properties: {
                effect: {
                    type: "number",
                    description: "Effect number (1-8)",
                    minimum: 1,
                    maximum: 8,
                },
                type: {
                    type: "number",
                    description: "Effect type number (0-40+ depending on available effects)",
                    minimum: 0,
                },
            },
            required: ["effect", "type"],
        },
    },
    {
        name: "osc_get_effect_type",
        description: "Get the effect type for an effect slot",
        inputSchema: {
            type: "object",
            properties: {
                effect: {
                    type: "number",
                    description: "Effect number (1-8)",
                    minimum: 1,
                    maximum: 8,
                },
            },
            required: ["effect"],
        },
    },
    // ========== More Dynamics Parameters ==========
    {
        name: "osc_set_compressor_knee",
        description: "Set compressor knee for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                knee: {
                    type: "number",
                    description: "Knee level (0.0 to 1.0, representing 0.0 to 5.0 dB)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "knee"],
        },
    },
    {
        name: "osc_set_compressor_makeup_gain",
        description: "Set compressor makeup gain for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                gain: {
                    type: "number",
                    description: "Makeup gain level (0.0 to 1.0, representing 0.0 to 24.0 dB)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "gain"],
        },
    },
    {
        name: "osc_set_compressor_detection",
        description: "Set compressor detection mode (PEAK or RMS)",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                detection: {
                    type: "number",
                    description: "Detection mode: 0=PEAK, 1=RMS",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "detection"],
        },
    },
    {
        name: "osc_set_gate_range",
        description: "Set gate range for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                range: {
                    type: "number",
                    description: "Gate range (0.0 to 1.0, representing 0.0 to 80.0 dB)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "range"],
        },
    },
    {
        name: "osc_set_gate_attack",
        description: "Set gate attack time for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                attack: {
                    type: "number",
                    description: "Attack time (0.0 to 1.0, representing 0.02ms to 2000ms)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "attack"],
        },
    },
    {
        name: "osc_set_gate_hold",
        description: "Set gate hold time for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                hold: {
                    type: "number",
                    description: "Hold time (0.0 to 1.0, representing 5ms to 4000ms)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "hold"],
        },
    },
    {
        name: "osc_set_gate_release",
        description: "Set gate release time for a channel",
        inputSchema: {
            type: "object",
            properties: {
                channel: {
                    type: "number",
                    description: "Channel number (1-32)",
                    minimum: 1,
                    maximum: 32,
                },
                release: {
                    type: "number",
                    description: "Release time (0.0 to 1.0, representing 5ms to 4000ms)",
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ["channel", "release"],
        },
    },
    // ========== Talkback ==========
    {
        name: "osc_set_talkback",
        description: "Enable or disable talkback",
        inputSchema: {
            type: "object",
            properties: {
                enabled: {
                    type: "boolean",
                    description: "True to enable, false to disable",
                },
            },
            required: ["enabled"],
        },
    },
    {
        name: "osc_get_talkback",
        description: "Get talkback status",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    // ========== Status ==========
    {
        name: "osc_get_mixer_status",
        description: "Get overall mixer status and information",
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
    // ========== Application Controls ==========
    {
        name: "osc_open_x32_edit",
        description:
            "Open the X32-Edit application to manually control the mixer or verify commands",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "osc_start_emulator",
        description:
            "Start the local X32 emulator server from the emulator/X32 binary so you can test without a physical mixer",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "osc_stop_emulator",
        description: "Stop the running X32 emulator server",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "osc_get_emulator_status",
        description: "Check if the X32 emulator is currently running",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
];

// Create MCP server
const server = new Server(
    {
        name: "x32-osc-mcp",
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
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} fader is at ${(level * 100).toFixed(1)}%`,
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
                return {
                    content: [
                        {
                            type: "text",
                            text: `Bus ${bus} fader is at ${(level * 100).toFixed(1)}%`,
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

            // ========== Aux Controls ==========
            case "osc_set_aux_fader": {
                const { aux, level } = args as { aux: number; level: number };
                await osc.setAuxFader(aux, level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set aux ${aux} fader to ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_get_aux_fader": {
                const { aux } = args as { aux: number };
                const level = await osc.getAuxFader(aux);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Aux ${aux} fader is at ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_mute_aux": {
                const { aux, mute } = args as { aux: number; mute: boolean };
                await osc.muteAux(aux, mute);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Aux ${aux} ${mute ? "muted" : "unmuted"}`,
                        },
                    ],
                };
            }

            case "osc_set_aux_pan": {
                const { aux, pan } = args as { aux: number; pan: number };
                await osc.setAuxPan(aux, pan);
                const panText =
                    pan < -0.1 ? "left" : pan > 0.1 ? "right" : "center";
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set aux ${aux} pan to ${panText} (${pan.toFixed(2)})`,
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

            case "osc_send_to_aux": {
                const { channel, aux, level } = args as {
                    channel: number;
                    aux: number;
                    level: number;
                };
                await osc.sendToAux(channel, aux, level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} send to aux ${aux} at ${(level * 100).toFixed(1)}%`,
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
                return {
                    content: [
                        {
                            type: "text",
                            text: `Main LR fader is at ${(level * 100).toFixed(1)}%`,
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

            // ========== Matrix ==========
            case "osc_set_matrix_fader": {
                const { matrix, level } = args as {
                    matrix: number;
                    level: number;
                };
                await osc.setMatrixFader(matrix, level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set matrix ${matrix} fader to ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_get_matrix_fader": {
                const { matrix } = args as { matrix: number };
                // We need to implement getMatrixFader in OSCClient first if it's missing
                // But let's assume we will add it or it exists (we need to check osc-client.ts)
                // Checking osc-client.ts... it WAS missing in the view.
                // So we need to add it to OSCClient too.
                // For now let's add the handler and we will fix OSCClient next.
                const level = await osc.getMatrixFader(matrix);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Matrix ${matrix} fader is at ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_mute_matrix": {
                const { matrix, mute } = args as {
                    matrix: number;
                    mute: boolean;
                };
                await osc.muteMatrix(matrix, mute);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Matrix ${matrix} ${mute ? "muted" : "unmuted"}`,
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

                // Validate scene number before proceeding
                if (scene < 1 || scene > 100) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Invalid scene number: ${scene}. Scene numbers must be between 1 and 100.`,
                            },
                        ],
                        isError: true,
                    };
                }

                try {
                    const name = await osc.getSceneName(scene);
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Scene ${scene} name is "${name}"`,
                            },
                        ],
                    };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Could not retrieve scene ${scene} name.\n\n${errorMessage}\n\nNote: The X32 typically requires XControl to be enabled before it will respond to scene name queries. Try enabling XControl first (osc_enable_xcontrol) and then query again.`,
                            },
                        ],
                        isError: true,
                    };
                }
            }

            // ========== System Commands ==========
            case "osc_get_info": {
                const info = await osc.getInfo();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Mixer Info:\n${JSON.stringify(info, null, 2)}`,
                        },
                    ],
                };
            }

            case "osc_enable_xcontrol": {
                await osc.enableXControl();
                return {
                    content: [
                        {
                            type: "text",
                            text: "XControl mode enabled. The mixer will now send parameter updates to this client (timeout: 10 seconds).",
                        },
                    ],
                };
            }

            // ========== Preamp Controls ==========
            case "osc_set_preamp_gain": {
                const { channel, gain } = args as { channel: number; gain: number };
                await osc.setPreampGain(channel, gain);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} preamp gain to ${(gain * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_get_preamp_gain": {
                const { channel } = args as { channel: number };
                const gain = await osc.getPreampGain(channel);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} preamp gain is at ${(gain * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_set_highpass_filter": {
                const { channel, enabled } = args as { channel: number; enabled: boolean };
                await osc.setHighPassFilter(channel, enabled);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} high-pass filter ${enabled ? "enabled" : "disabled"}`,
                        },
                    ],
                };
            }

            case "osc_set_highpass_filter_frequency": {
                const { channel, frequency } = args as { channel: number; frequency: number };
                await osc.setHighPassFilterFrequency(channel, frequency);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} high-pass filter frequency to ${(frequency * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_set_phantom_power": {
                const { headamp, enabled } = args as { headamp: number; enabled: boolean };
                await osc.setPhantomPower(headamp, enabled);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Headamp ${headamp} phantom power ${enabled ? "enabled" : "disabled"}`,
                        },
                    ],
                };
            }

            // ========== Insert Effects ==========
            case "osc_set_insert_on": {
                const { channel, enabled } = args as { channel: number; enabled: boolean };
                await osc.setInsertOn(channel, enabled);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} insert effect ${enabled ? "enabled" : "disabled"}`,
                        },
                    ],
                };
            }

            case "osc_set_insert_position": {
                const { channel, position } = args as { channel: number; position: number };
                await osc.setInsertPosition(channel, position);
                const posNames = ["PRE", "POST", "INS", "INS"];
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} insert position to ${posNames[position] || position}`,
                        },
                    ],
                };
            }

            // ========== Solo Controls ==========
            case "osc_set_solo": {
                const { channel, solo } = args as { channel: number; solo: boolean };
                await osc.setSolo(channel, solo);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} ${solo ? "soloed" : "unsoloed"}`,
                        },
                    ],
                };
            }

            case "osc_get_solo": {
                const { channel } = args as { channel: number };
                const solo = await osc.getSolo(channel);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Channel ${channel} is ${solo ? "soloed" : "not soloed"}`,
                        },
                    ],
                };
            }

            // ========== DCA Groups ==========
            case "osc_set_dca_on": {
                const { dca, on } = args as { dca: number; on: boolean };
                await osc.setDCAOn(dca, on);
                return {
                    content: [
                        {
                            type: "text",
                            text: `DCA ${dca} ${on ? "enabled" : "disabled"}`,
                        },
                    ],
                };
            }

            case "osc_set_dca_fader": {
                const { dca, level } = args as { dca: number; level: number };
                await osc.setDCAFader(dca, level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set DCA ${dca} fader to ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_get_dca_fader": {
                const { dca } = args as { dca: number };
                const level = await osc.getDCAFader(dca);
                return {
                    content: [
                        {
                            type: "text",
                            text: `DCA ${dca} fader is at ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_set_dca_name": {
                const { dca, name } = args as { dca: number; name: string };
                await osc.setDCAName(dca, name);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set DCA ${dca} name to "${name}"`,
                        },
                    ],
                };
            }

            // ========== Output Controls ==========
            case "osc_set_output_source": {
                const { outputType, output, source } = args as {
                    outputType: "main" | "aux" | "p16" | "aes" | "rec";
                    output: number;
                    source: number;
                };
                await osc.setOutputSource(outputType, output, source);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set ${outputType} output ${output} source to ${source}`,
                        },
                    ],
                };
            }

            case "osc_set_output_delay": {
                const { outputType, output, enabled } = args as {
                    outputType: "main" | "aux" | "p16" | "aes" | "rec";
                    output: number;
                    enabled: boolean;
                };
                await osc.setOutputDelay(outputType, output, enabled);
                return {
                    content: [
                        {
                            type: "text",
                            text: `${outputType} output ${output} delay ${enabled ? "enabled" : "disabled"}`,
                        },
                    ],
                };
            }

            case "osc_set_output_delay_time": {
                const { outputType, output, time } = args as {
                    outputType: "main" | "aux" | "p16" | "aes" | "rec";
                    output: number;
                    time: number;
                };
                await osc.setOutputDelayTime(outputType, output, time);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set ${outputType} output ${output} delay time to ${(time * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            // ========== Main Mono ==========
            case "osc_set_main_mono_fader": {
                const { level } = args as { level: number };
                await osc.setMainMonoFader(level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set main mono fader to ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_get_main_mono_fader": {
                const level = await osc.getMainMonoFader();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Main mono fader is at ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_mute_main_mono": {
                const { mute } = args as { mute: boolean };
                await osc.muteMainMono(mute);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Main mono mix ${mute ? "muted" : "unmuted"}`,
                        },
                    ],
                };
            }

            // ========== Matrix Controls ==========
            case "osc_set_matrix_name": {
                const { matrix, name } = args as { matrix: number; name: string };
                await osc.setMatrixName(matrix, name);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set matrix ${matrix} name to "${name}"`,
                        },
                    ],
                };
            }

            case "osc_get_matrix_name": {
                const { matrix } = args as { matrix: number };
                const name = await osc.getMatrixName(matrix);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Matrix ${matrix} name is "${name}"`,
                        },
                    ],
                };
            }

            case "osc_send_to_matrix": {
                const { channel, matrix, level } = args as {
                    channel: number;
                    matrix: number;
                    level: number;
                };
                await osc.sendToMatrix(channel, matrix, level);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} send to matrix ${matrix} at ${(level * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            // ========== Effect Type ==========
            case "osc_set_effect_type": {
                const { effect, type } = args as { effect: number; type: number };
                await osc.setEffectType(effect, type);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set effect ${effect} type to ${type}`,
                        },
                    ],
                };
            }

            case "osc_get_effect_type": {
                const { effect } = args as { effect: number };
                const type = await osc.getEffectType(effect);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Effect ${effect} type is ${type}`,
                        },
                    ],
                };
            }

            // ========== More Dynamics Parameters ==========
            case "osc_set_compressor_knee": {
                const { channel, knee } = args as { channel: number; knee: number };
                await osc.setCompressorKnee(channel, knee);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} compressor knee to ${(knee * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_set_compressor_makeup_gain": {
                const { channel, gain } = args as { channel: number; gain: number };
                await osc.setCompressorMakeupGain(channel, gain);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} compressor makeup gain to ${(gain * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_set_compressor_detection": {
                const { channel, detection } = args as { channel: number; detection: number };
                await osc.setCompressorDetection(channel, detection);
                const mode = detection === 0 ? "PEAK" : "RMS";
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} compressor detection to ${mode}`,
                        },
                    ],
                };
            }

            case "osc_set_gate_range": {
                const { channel, range } = args as { channel: number; range: number };
                await osc.setGateRange(channel, range);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} gate range to ${(range * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_set_gate_attack": {
                const { channel, attack } = args as { channel: number; attack: number };
                await osc.setGateAttack(channel, attack);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} gate attack to ${(attack * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_set_gate_hold": {
                const { channel, hold } = args as { channel: number; hold: number };
                await osc.setGateHold(channel, hold);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} gate hold to ${(hold * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            case "osc_set_gate_release": {
                const { channel, release } = args as { channel: number; release: number };
                await osc.setGateRelease(channel, release);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set channel ${channel} gate release to ${(release * 100).toFixed(1)}%`,
                        },
                    ],
                };
            }

            // ========== Talkback ==========
            case "osc_set_talkback": {
                const { enabled } = args as { enabled: boolean };
                await osc.setTalkback(enabled);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Talkback ${enabled ? "enabled" : "disabled"}`,
                        },
                    ],
                };
            }

            case "osc_get_talkback": {
                const enabled = await osc.getTalkback();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Talkback is ${enabled ? "enabled" : "disabled"}`,
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

            // ========== Application Controls ==========
            case "osc_open_x32_edit": {
                try {
                    await execAsync("open /Applications/X32-Edit.app");
                    return {
                        content: [
                            {
                                type: "text",
                                text: "X32-Edit application opened successfully. You can now manually control the mixer or verify that commands were applied.",
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Failed to open X32-Edit: ${error instanceof Error ? error.message : String(error)}. Make sure X32-Edit.app is installed at /Applications/X32-Edit.app`,
                            },
                        ],
                        isError: true,
                    };
                }
            }

            case "osc_start_emulator": {
                try {
                    // Check if emulator is already running
                    if (emulatorPid !== null) {
                        try {
                            // Check if process is still alive (signal 0 doesn't kill, just checks)
                            process.kill(emulatorPid, 0);
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `X32 emulator is already running (PID: ${emulatorPid}). No need to start it again.`,
                                    },
                                ],
                            };
                        } catch {
                            // Process doesn't exist, reset variables
                            emulatorProcess = null;
                            emulatorPid = null;
                        }
                    }

                    const emulatorPath = path.resolve(__dirname, "../emulator/X32");

                    const child = spawn(emulatorPath, [], {
                        detached: true,
                        stdio: "ignore",
                    });

                    emulatorProcess = child;
                    emulatorPid = child.pid || null;

                    child.unref();

                    // Wait a moment to check if process started successfully
                    await new Promise((resolve) => setTimeout(resolve, 500));

                    // Verify process is still running
                    if (emulatorPid !== null) {
                        try {
                            process.kill(emulatorPid, 0);
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `X32 emulator started successfully (PID: ${emulatorPid}) from ${emulatorPath}. It is now running in the background so you can test without connecting to a physical mixer.`,
                                    },
                                ],
                            };
                        } catch {
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `X32 emulator process started but appears to have exited immediately. Check if the emulator binary exists at ${emulatorPath} and is executable (chmod +x emulator/X32).`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                    } else {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Failed to get PID from emulator process. The emulator may not have started correctly.`,
                                },
                            ],
                            isError: true,
                        };
                    }
                } catch (error) {
                    emulatorProcess = null;
                    emulatorPid = null;
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Failed to start X32 emulator: ${error instanceof Error ? error.message : String(error)
                                    }. Make sure the emulator binary exists at emulator/X32 and is executable (chmod +x emulator/X32).`,
                            },
                        ],
                        isError: true,
                    };
                }
            }

            case "osc_stop_emulator": {
                try {
                    if (emulatorPid === null || emulatorProcess === null) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "X32 emulator is not running. Nothing to stop.",
                                },
                            ],
                        };
                    }

                    // Check if process is still alive
                    try {
                        process.kill(emulatorPid, 0);
                    } catch {
                        // Process already dead
                        emulatorProcess = null;
                        emulatorPid = null;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "X32 emulator process was not running (may have already stopped).",
                                },
                            ],
                        };
                    }

                    // Try to kill the process gracefully first (SIGTERM)
                    try {
                        process.kill(emulatorPid, "SIGTERM");
                        // Wait a bit for graceful shutdown
                        await new Promise((resolve) => setTimeout(resolve, 1000));

                        // Check if still running
                        try {
                            process.kill(emulatorPid, 0);
                            // Still running, force kill
                            process.kill(emulatorPid, "SIGKILL");
                        } catch {
                            // Process terminated successfully
                        }
                    } catch (killError) {
                        // If kill fails, process might already be dead
                        try {
                            process.kill(emulatorPid, 0);
                            // Still alive, try force kill
                            process.kill(emulatorPid, "SIGKILL");
                        } catch {
                            // Process is dead
                        }
                    }

                    emulatorProcess = null;
                    emulatorPid = null;

                    return {
                        content: [
                            {
                                type: "text",
                                text: "X32 emulator stopped successfully.",
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Failed to stop X32 emulator: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }

            case "osc_get_emulator_status": {
                try {
                    if (emulatorPid === null) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "X32 emulator is not running.",
                                },
                            ],
                        };
                    }

                    // Check if process is still alive
                    try {
                        process.kill(emulatorPid, 0);
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `X32 emulator is running (PID: ${emulatorPid}).`,
                                },
                            ],
                        };
                    } catch {
                        // Process is dead, reset variables
                        emulatorProcess = null;
                        emulatorPid = null;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "X32 emulator is not running (process has terminated).",
                                },
                            ],
                        };
                    }
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error checking emulator status: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    };
                }
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
    console.error("Starting X32 OSC MCP Server...");
    console.error(`Connecting to Behringer X32 at ${OSC_HOST}:${OSC_PORT}`);

    await osc.connect();

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("X32 OSC MCP Server running");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
