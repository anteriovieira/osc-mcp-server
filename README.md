# OSC MCP Server

A Model Context Protocol (MCP) server for controlling **X-Air family** digital mixers (Behringer XR12, XR16, XR18; Midas MR18) via OSC (Open Sound Control). Control your mixer through chat commands in Claude Desktop or other MCP-compatible agents.

## Features

- 🎚️ **Fader Control**: Set and get fader levels for channels (1-16), buses (1-6), and main LR
- 🔇 **Mute/Unmute**: Control muting for channels, buses, and main mix
- 🎛️ **Pan Control**: Adjust stereo positioning for channels, buses, and main mix
- 🎵 **EQ Control**: Full 4-band parametric EQ with frequency, Q, gain, and on/off control
- 🎚️ **Dynamics**: Complete gate and compressor control with attack, release, threshold, and ratio
- 🔊 **Bus Sends**: Control sends from channels to mix buses (1-6)
- 📸 **Scenes**: Recall, save, and manage snapshots (1-64) with custom names
- 🎛️ **Bus Control**: Full control over mix buses 1-6 with faders, pan, mute, and naming
- 🎵 **Effects**: Control effects 1-4 with on/off, mix, and parameter adjustment
- 🎚️ **FX Sends**: Channel sends to FX 1-4 (reverb, etc.) with dB-calibrated levels
- 🔌 **Routing**: Configure channel input sources (0-15)
- 📝 **Naming**: Set and get names for channels and buses
- 🔧 **Custom Commands**: Send any OSC command to the mixer
- 📊 **Status Monitoring**: Get mixer status, overview snapshots, and live meters

## Installation

### Prerequisites

- Node.js 18 or higher
- An X-Air family mixer (Behringer XR12, XR16, XR18; Midas MR18) on your network
- Claude Desktop app (or another MCP-compatible agent)

### Setup

1. Clone or navigate to this repository:
```bash
cd path/to/osc-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### Supported mixers and limits

This server supports **X-Air family only** (Behringer XR12, XR16, XR18; Midas MR18):

- **Channels**: 1–16
- **Buses**: 1–6
- **Effects**: 1–4
- **Scenes (snapshots)**: 1–64
- **Channel input source**: 0–15 (X-Air `insrc`)

Scene names (`osc_get_scene_name`) return a value only when that scene is the current snapshot; otherwise they return an empty string.

### Environment Variables

- `OSC_HOST`: IP address of your X-Air mixer (default: `192.168.1.17`)
- `OSC_PORT`: OSC port (default: `10024` for X-Air)

### Claude Desktop Configuration

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
      "osc": {
      "command": "node",
      "args": [
        "/path/to/osc-mcp/dist/index.js"
      ],
      "env": {
        "OSC_HOST": "192.168.1.70",
        "OSC_PORT": "10024"
      }
    }
  }
}
```

**Important**: Replace the IP address `192.168.1.70` with your mixer's actual IP address!

### Finding Your Mixer IP Address

1. On your mixer, press the `SETUP` button
2. Navigate to `Network` settings
3. Note the IP address shown

## Usage Examples

Once configured in Claude Desktop, you can use natural language to control your mixer:

### Reading Mixer State
- "Give me an overview of the mixer"
- "What's on channel 1 — full detail for soundcheck"
- "Which channels are hot right now?"
- "Check input levels before we start"
- "Is anything clipping on the vocal channel?"

### Basic Fader Control
- "Set channel 1 fader to 75%"
- "What's the current level of channel 5?"
- "Set the main fader to 80%"
- "Set bus 3 fader to 60%"

### Muting
- "Mute channel 3"
- "Unmute channel 7"
- "Mute bus 5"
- "Unmute the main mix"

### Pan Control
- "Pan channel 2 to the left"
- "Center the pan on channel 4"
- "Pan channel 8 to the right"
- "Set bus 2 pan to center"

### EQ
- "Boost channel 1 EQ band 2 by 3dB"
- "Cut channel 5 EQ band 4 by 6dB"
- "Set channel 3 EQ band 1 frequency to 100Hz"
- "Set channel 2 EQ band 3 Q to 2.5"
- "Enable EQ on channel 1"

### Dynamics
- "Set channel 1 gate threshold to -40dB"
- "Set channel 3 compressor with -20dB threshold and 4:1 ratio"
- "Set channel 2 compressor attack to 50%"
- "Set channel 4 compressor release to 30%"
- "Enable gate on channel 5"

### Bus Sends
- "Send channel 1 to bus 3 at 50%"
- "What's the send level from channel 2 to bus 5?"

### Bus Control
- "Set bus 1 fader to 70%"
- "Mute bus 3"
- "Pan bus 2 to the right"
- "Name bus 4 'Monitor'"

### Effects
- "Enable effect 1"
- "Set effect 2 mix to 50%"
- "Set effect 3 parameter 5 to 75%"

### Routing
- "Set channel 1 source to input 5"
- "What's the source for channel 3?"

### Scenes
- "Recall scene 5"
- "Save the current mix as scene 10"
- "Save scene 15 as 'Concert Setup'"
- "What's the name of scene 3?"

### Channel Management
- "Name channel 1 'Lead Vocal'"
- "What's the name of channel 5?"
- "Set channel 2 color to 3"

### Custom Commands
- "Send OSC command /ch/01/config/name with value 'Vocals'"
- "Send OSC command /ch/05/mix/fader with value 0.75"
- "Send OSC command /bus/03/mix/on with value 1"
- "Send OSC command /fx/1/insert with value 1"

## Available Tools

The MCP server exposes **53 tools** for X-Air mixer control. Limits: channels 1-16, buses 1-6, effects 1-4, FX sends (buses 7-10), scenes 1-64.

### Reading Mixer State (3 tools)

Prefer these before making bulk changes or when diagnosing signal issues:

- **osc_get_mixer_overview** — Scene, main, all channels, and buses in one JSON snapshot. Optional `includeSends` and `includeDynamics`.
- **osc_get_channel_detail** — Deep read of one channel: HPF, EQ, dynamics, bus/FX sends (with dB).
- **osc_get_meters** — Live signal levels in dB. `mode: "cache"` (instant) or `"snapshot"` (fresh). Returns `input` (/meters/2), `mix` (/meters/1), plus `hotChannels` (> -6 dB) and `silentChannels` (< -60 dB).

Fader get tools (`osc_get_fader`, `osc_get_bus_fader`, `osc_get_main_fader`) now include dB in the response.

### Composite Workflows (4 tools)

Higher-level tools that run vetted multi-step jobs in one call. All write composites return a `changes` array for transparency and support `dryRun: true` to preview without applying.

- **osc_apply_channel_preset** — Apply preset `vocal`, `bass`, `acoustic-guitar`, `electric-guitar-forro`, or `percussion` to a channel (by number or name). Sets HPF, EQ, compressor, and optional FX send.
- **osc_mute_all_except** — Mute all channels except a list (e.g. solo vocals: `channels: ["Vocals"]`). Optional `includeMain: true` ensures main LR stays unmuted.
- **osc_soundcheck_channel** — One JSON report for a channel: fader, HPF, EQ, dynamics, sends, and input/mix meters.
- **osc_setup_monitor_mix** — Name a bus, set bus fader, and configure sends from listed channels.

Example: "apply vocal preset to channel 5" → `osc_apply_channel_preset({ channel: 5, preset: "vocal" })`. "Mute everything except Vocals and Guitar" → `osc_mute_all_except({ channels: ["Vocals", "Guitar"] })`.

### Channel Controls (13 tools)
- **osc_set_fader** / **osc_get_fader** - Channel fader level (0.0-1.0, 0.75=0dB)
- **osc_mute_channel** / **osc_get_mute** - Mute/unmute
- **osc_set_pan** / **osc_get_pan** - Pan (-1.0 to 1.0)
- **osc_set_channel_name** / **osc_get_channel_name** - Channel name
- **osc_set_hpf_on** / **osc_set_hpf** / **osc_get_hpf** - High-pass filter (20-400 Hz)
- **osc_set_channel_source** / **osc_get_channel_source** - Input source (0-15)

### EQ Controls (5 tools)
- **osc_set_eq** / **osc_get_eq** - EQ band gain (-15dB to +15dB)
- **osc_set_eq_frequency** - EQ band frequency
- **osc_set_eq_q** - EQ band Q factor
- **osc_set_eq_on** - Enable/disable EQ

### Dynamics Controls (7 tools)
- **osc_set_gate** / **osc_get_gate** / **osc_set_gate_on** - Gate
- **osc_set_compressor** / **osc_set_compressor_attack** / **osc_set_compressor_release** / **osc_set_compressor_on** - Compressor

### Bus Controls (5 tools)
- **osc_set_bus_fader** / **osc_get_bus_fader** - Bus fader (buses 1-6)
- **osc_mute_bus** / **osc_set_bus_pan** / **osc_set_bus_name** - Mute, pan, name

### Sends (4 tools)
- **osc_send_to_bus** / **osc_get_send_to_bus** - Channel send to bus (1-6)
- **osc_send_to_fx** / **osc_get_send_to_fx** - Channel send to FX 1-4 (buses 7-10). Use `levelDb` for dB values (e.g. -20 for subtle, -12 for medium reverb)

### Main Mix (4 tools)
- **osc_set_main_fader** / **osc_get_main_fader** / **osc_mute_main** / **osc_set_main_pan**

### Effects (3 tools)
- **osc_set_effect_on** / **osc_set_effect_mix** / **osc_set_effect_param** - Effects 1-4

### Scenes (3 tools)
- **osc_scene_recall** / **osc_scene_save** / **osc_get_scene_name** - Snapshots 1-64

### Status & Custom (2 tools)
- **osc_get_mixer_status** — Connection info, current scene, main fader/mute
- **osc_custom_command** - Send custom OSC command

## Reading Mixer State

The server subscribes to X-Air meter streams (`/meters/1` and `/meters/2`) in the background and renews every 8 seconds. Use:

| Tool | When to use |
|------|-------------|
| `osc_get_mixer_overview` | Before show, after scene recall, or any "what's the mix look like?" question |
| `osc_get_channel_detail` | Soundcheck or troubleshooting one channel |
| `osc_get_meters` | "Is channel 3 getting signal?" / "What's loud?" — use `snapshot` before/after gain changes |

Meter values are in dB (X-Air resolution: 1/256 dB). Overview responses include `faderDb` fields using the X-Air fader scale (0.75 = 0 dB).

Run unit tests for meter parsing (no hardware required):

```bash
npm run test:unit
```

## Technical Details

### Dependencies:
- **@modelcontextprotocol/sdk** - MCP server framework
- **osc-js** - OSC protocol implementation (v2.4.1)
- **TypeScript** - Type-safe development

### OSC Communication
- Protocol: UDP
- Default port: 10024 (X-Air)
- Bidirectional communication with mixer
- Connection keep-alive (/xremote every 9 seconds)
- Uses `osc-js` library with DatagramPlugin for UDP communication

### Supported mixers

- **X-Air family** (port 10024): Behringer XR12, XR16, XR18; Midas MR18

## Development

### Watch Mode
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Run Directly
```bash
npm start
```

## Troubleshooting

### Connection Issues

1. **Verify network connectivity**: Ping your mixer
   ```bash
   ping 192.168.1.70
   ```

2. **Check OSC settings**: Ensure OSC is enabled on the mixer

3. **Firewall**: Make sure your firewall allows UDP traffic on port 10024

4. **Check Claude Desktop logs**: 
   - macOS: `~/Library/Logs/Claude/`

### Common Issues

- **"Timeout waiting for response"**: The mixer might not be responding. Check network connection and mixer settings.
- **"Connection refused"**: Verify the IP address and port are correct.
- **Tools not appearing in Claude**: Restart Claude Desktop after updating the config file.

## Custom OSC Commands

The `osc_custom_command` tool allows you to send any OSC command to the mixer. This is useful for accessing features not covered by the standard tools.

### Examples

#### Setting Channel Names
```json
{
  "address": "/ch/01/config/name",
  "value": "Lead Vocal"
}
```

#### Setting Channel Colors
```json
{
  "address": "/ch/05/config/color",
  "value": 3
}
```

#### Controlling Headamp Gain (X-Air)
```json
{
  "address": "/headamp/01/gain",
  "value": 0.5
}
```

#### Setting High-Pass Filter / Low Cut (X-Air)
Use the dedicated tools `osc_set_hpf_on` and `osc_set_hpf` for best compatibility.

Or via custom command (channel 05, 100 Hz for male vocal):
```json
{"address": "/ch/05/preamp/hpon", "value": 1}
```
```json
{"address": "/ch/05/preamp/hpf", "value": 100}
```

**Note:** X-Air expects normalized 0.0-1.0 (logarithmic scale, 20-400 Hz). The MCP tools send normalized; formula: `(log10(Hz) - log10(20)) / (log10(400) - log10(20))` (e.g. 100 Hz → ~0.537).

#### Controlling Insert Effects (X-Air)
```json
{
  "address": "/ch/04/insert/on",
  "value": 1
}
```

#### Setting Bus Configuration
```json
{
  "address": "/bus/02/config/name",
  "value": "Monitor"
}
```

#### Controlling Effects Parameters (X-Air: effects 1-4)
```json
{
  "address": "/fx/1/par/01",
  "value": 0.75
}
```

#### Controlling Talkback
```json
{
  "address": "/-stat/talk",
  "value": 1
}
```

#### Setting Solo
```json
{
  "address": "/ch/01/mix/solo",
  "value": 1
}
```

#### Commands Without Values
Some OSC commands don't require a value:
```json
{
  "address": "/-stat/solosw"
}
```

### Common OSC Addresses

#### Channel Configuration (X-Air: channels 01-16)
- `/ch/{nn}/config/name` - Channel name (string)
- `/ch/{nn}/config/color` - Channel color (0-15)
- `/ch/{nn}/config/insrc` - Input source (0-15)
- `/ch/{nn}/preamp/hpon` - High-pass filter on (0/1). Use `osc_set_hpf_on`
- `/ch/{nn}/preamp/hpf` - High-pass filter frequency. Use `osc_set_hpf` (20-400 Hz, logarithmic scale 0.0-1.0, clamped)

#### Channel Mix
- `/ch/{nn}/mix/solo` - Solo channel (0/1)
- `/ch/{nn}/mix/st` - Send to stereo (0.0-1.0)
- `/ch/{nn}/mix/mlevel` - Monitor level (0.0-1.0)

#### Insert Effects
- `/ch/{nn}/insert/on` - Insert effect on (0/1)
- `/ch/{nn}/insert/pos` - Insert position (0-3)

#### Bus Configuration (X-Air: buses 1-6)
- `/bus/{n}/config/name` - Bus name (string)
- `/bus/{n}/config/color` - Bus color (0-15)

#### Effects (X-Air: 1-4)
- `/fx/{n}/insert` - Effect insert on (0/1)
- `/fx/{n}/mix` - Effect mix (0.0-1.0)
- `/fx/{n}/par/{nn}` - Effect parameter (0.0-1.0)

#### System
- `/-stat/talk` - Talkback (0/1)
- `/-stat/solosw` - Solo switch (no value)
- `/-stat/rtn` - Return solo (0/1)

**Note**: For X-Air, channel numbers are zero-padded (e.g. `01`, `16`). Bus numbers are 1-6 (unpadded). Effect numbers are 1-4. **FX 1-4 are buses 7-10** (`/ch/{nn}/mix/07/level` through `mix/10/level`).

### FX Send Level Scale (osc_send_to_fx)

The `osc_send_to_fx` tool accepts `levelDb` for dB values. The X-Air FX send display uses a calibrated scale: `dB ≈ 66×log₁₀(value)+8`. Recommended levels:
- **Very subtle**: -24 dB
- **Subtle**: -20 dB
- **Medium**: -12 dB
- **A lot**: -6 dB

### Value Types

The `osc_custom_command` tool automatically detects value types:
- **Numbers**: Automatically sent as float or integer
- **Strings**: Sent as OSC string type
- **Arrays**: Can be used for multiple arguments

Example with multiple arguments:
```json
{
  "address": "/custom/path",
  "value": [0.5, "text", 42]
}
```

## X-Air OSC Reference

For the complete X-Air OSC command reference, see [X-Air / M-Air OSC Commands](https://behringer.world/wiki/doku.php?id=x-air_osc).

## Inspiration

This project was inspired by OSC control work for digital mixers; it is simplified here to focus exclusively on the X-Air family to avoid confusing agents and keep the tool set aligned with one platform.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
