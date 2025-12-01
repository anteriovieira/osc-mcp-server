# X32 OSC MCP Server

A Model Context Protocol (MCP) server for controlling the Behringer X32 digital mixer via OSC (Open Sound Control). This allows you to control your X32 mixer through natural language commands in Claude Desktop and other MCP-compatible AI assistants.

## Features

- 🎚️ **Fader Control**: Set and get fader levels for all channels, buses, aux, matrix, and main LR
- 🔇 **Mute/Unmute**: Control muting for channels, buses, aux, matrix, and main mix
- 🎛️ **Pan Control**: Adjust stereo positioning for channels, buses, aux, and main mix
- 🎵 **EQ Control**: Full 6-band parametric EQ with frequency, Q, gain, and on/off control
- 🎚️ **Dynamics**: Complete gate and compressor control with attack, release, threshold, and ratio
- 🔊 **Aux Sends**: Control sends from channels to mix buses and aux outputs
- 📸 **Scenes**: Recall, save, and manage scenes with custom names
- 🎛️ **Bus Control**: Full control over mix buses (1-16) with faders, pan, mute, and naming
- 🔊 **Aux Control**: Control aux outputs (1-6) with faders, pan, and mute
- 🎚️ **Matrix Control**: Control matrix outputs (1-6) with faders and mute
- 🎵 **Effects**: Control effects (1-8) with on/off, mix, and parameter adjustment
- 🔌 **Routing**: Configure channel input sources
- 📝 **Naming**: Set and get names for channels and buses
- 🔧 **Custom Commands**: Send any OSC command to the mixer
- 📊 **Status Monitoring**: Get mixer status and information

## Installation

### Prerequisites

- Node.js 18 or higher
- A Behringer X32 digital mixer (or compatible X32 variant) on your network
- Claude Desktop app or another MCP-compatible AI assistant

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

### Environment Variables

You can configure the OSC connection using environment variables:

- `OSC_HOST`: IP address of your mixer (default: `192.168.1.70`)
- `OSC_PORT`: OSC port of your mixer (default: `10023`)

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
        "OSC_PORT": "10023"
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

### Basic Fader Control
- "Set channel 1 fader to 75%"
- "What's the current level of channel 5?"
- "Set the main fader to 80%"
- "Set bus 3 fader to 60%"
- "What's the aux 2 fader level?"

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

### Aux Sends
- "Send channel 1 to bus 3 at 50%"
- "What's the send level from channel 2 to bus 5?"
- "Send channel 4 to aux 2 at 75%"

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
- "Send OSC command /fx/01/on with value 1"

## Available Tools

The MCP server exposes **97 tools** for comprehensive X32 mixer control:

### Channel Controls (9 tools)
1. **osc_set_fader** - Set channel fader level (0.0-1.0)
2. **osc_get_fader** - Get current channel fader level
3. **osc_mute_channel** - Mute/unmute a channel
4. **osc_get_mute** - Get mute status of a channel
5. **osc_set_pan** - Set channel pan (-1.0 to 1.0)
6. **osc_get_pan** - Get channel pan position
7. **osc_set_channel_name** - Set channel name
8. **osc_get_channel_name** - Get channel name
9. **osc_set_channel_source** / **osc_get_channel_source** - Configure input source

### EQ Controls (5 tools)
10. **osc_set_eq** - Set EQ band gain (-15dB to +15dB) for bands 1-6
11. **osc_get_eq** - Get EQ band gain
12. **osc_set_eq_frequency** - Set EQ band frequency
13. **osc_set_eq_q** - Set EQ band Q factor
14. **osc_set_eq_on** - Enable/disable EQ

### Dynamics Controls (7 tools)
15. **osc_set_gate** - Set gate threshold (-80dB to 0dB)
16. **osc_get_gate** - Get gate threshold
17. **osc_set_gate_on** - Enable/disable gate
18. **osc_set_compressor** - Set compressor threshold and ratio
19. **osc_set_compressor_attack** - Set compressor attack time
20. **osc_set_compressor_release** - Set compressor release time
21. **osc_set_compressor_on** - Enable/disable compressor

### Bus Controls (5 tools)
22. **osc_set_bus_fader** - Set bus fader level
23. **osc_get_bus_fader** - Get bus fader level
24. **osc_mute_bus** - Mute/unmute a bus
25. **osc_set_bus_pan** - Set bus pan position
26. **osc_set_bus_name** - Set bus name

### Aux Controls (4 tools)
27. **osc_set_aux_fader** - Set aux fader level
28. **osc_get_aux_fader** - Get aux fader level
29. **osc_mute_aux** - Mute/unmute an aux output
30. **osc_set_aux_pan** - Set aux pan position

### Sends (3 tools)
31. **osc_send_to_bus** - Set send level from channel to bus
32. **osc_get_send_to_bus** - Get send level from channel to bus
33. **osc_send_to_aux** - Set send level from channel to aux

### Main Mix (4 tools)
34. **osc_set_main_fader** - Set main LR fader level
35. **osc_get_main_fader** - Get main LR fader level
36. **osc_mute_main** - Mute/unmute main LR mix
37. **osc_set_main_pan** - Set main LR pan position

### Matrix (2 tools)
38. **osc_set_matrix_fader** - Set matrix fader level
39. **osc_mute_matrix** - Mute/unmute a matrix output

### Effects (3 tools)
40. **osc_set_effect_on** - Enable/disable an effect
41. **osc_set_effect_mix** - Set effect mix level
42. **osc_set_effect_param** - Set effect parameter value

### Scenes (3 tools)
43. **osc_scene_recall** - Recall a saved scene (1-100)
44. **osc_scene_save** - Save current mixer state as a scene
45. **osc_get_scene_name** - Get scene name

### System Commands (2 tools)
46. **osc_get_info** - Get mixer information (server version, name, console model, version)
47. **osc_enable_xcontrol** - Enable XControl mode to receive parameter updates

### Preamp Controls (4 tools)
48. **osc_set_preamp_gain** - Set preamp gain (headamp trim) for a channel
49. **osc_get_preamp_gain** - Get preamp gain for a channel
50. **osc_set_highpass_filter** - Enable/disable high-pass filter
51. **osc_set_highpass_filter_frequency** - Set high-pass filter frequency
52. **osc_set_phantom_power** - Set phantom power for a headamp (0-127)

### Insert Effects (2 tools)
53. **osc_set_insert_on** - Enable/disable insert effect for a channel
54. **osc_set_insert_position** - Set insert effect position

### Solo Controls (2 tools)
55. **osc_set_solo** - Solo/unsolo a channel
56. **osc_get_solo** - Get solo status of a channel

### DCA Groups (4 tools)
57. **osc_set_dca_on** - Enable/disable a DCA group (1-8)
58. **osc_set_dca_fader** - Set DCA fader level
59. **osc_get_dca_fader** - Get DCA fader level
60. **osc_set_dca_name** - Set DCA group name

### Output Controls (3 tools)
61. **osc_set_output_source** - Set source for outputs (main, aux, p16, aes, rec)
62. **osc_set_output_delay** - Enable/disable delay for outputs
63. **osc_set_output_delay_time** - Set delay time for outputs

### Main Mono (3 tools)
64. **osc_set_main_mono_fader** - Set main mono fader level
65. **osc_get_main_mono_fader** - Get main mono fader level
66. **osc_mute_main_mono** - Mute/unmute main mono mix

### Matrix Controls (3 tools)
67. **osc_set_matrix_name** - Set matrix output name
68. **osc_get_matrix_name** - Get matrix output name
69. **osc_send_to_matrix** - Set send level from channel to matrix

### Effect Type (2 tools)
70. **osc_set_effect_type** - Set effect type for an effect slot
71. **osc_get_effect_type** - Get effect type for an effect slot

### Additional Dynamics Parameters (5 tools)
72. **osc_set_compressor_knee** - Set compressor knee
73. **osc_set_compressor_makeup_gain** - Set compressor makeup gain
74. **osc_set_compressor_detection** - Set compressor detection mode (PEAK/RMS)
75. **osc_set_gate_range** - Set gate range
76. **osc_set_gate_attack** - Set gate attack time
77. **osc_set_gate_hold** - Set gate hold time
78. **osc_set_gate_release** - Set gate release time

### Talkback (2 tools)
79. **osc_set_talkback** - Enable/disable talkback
80. **osc_get_talkback** - Get talkback status

### Status & Custom (2 tools)
81. **osc_get_mixer_status** - Get mixer status and info
82. **osc_custom_command** - Send custom OSC command

## Technical Details

### Dependencies:
- **@modelcontextprotocol/sdk** - MCP server framework
- **osc-js** - OSC protocol implementation (v2.4.1)
- **TypeScript** - Type-safe development

### OSC Communication:
- Protocol: UDP
- Default Port: 10023
- Bidirectional communication with mixer
- Automatic connection keep-alive (/xremote every 9 seconds)
- Uses `osc-js` library with DatagramPlugin for UDP communication

### Supported Mixer Models:
This MCP server is specifically designed for the Behringer X32 console and compatible variants:
- Behringer X32
- Behringer X32 Compact
- Behringer X32 Producer
- Behringer X32 Rack

**Note**: While the Midas M32 shares similar OSC protocol features, this server is optimized and tested specifically for the Behringer X32.

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

3. **Firewall**: Make sure your firewall allows UDP traffic on port 10023

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

#### Controlling Channel Preamp Gain
```json
{
  "address": "/ch/03/preamp/trim",
  "value": 0.5
}
```

#### Setting High-Pass Filter
```json
{
  "address": "/ch/02/hpf",
  "value": 1
}
```

#### Controlling Insert Effects
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

#### Controlling Effects Parameters
```json
{
  "address": "/fx/01/par/01",
  "value": 0.75
}
```

#### Setting Matrix Configuration
```json
{
  "address": "/mtx/01/config/name",
  "value": "Recording"
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

#### Channel Configuration
- `/ch/{nn}/config/name` - Channel name (string)
- `/ch/{nn}/config/color` - Channel color (0-15)
- `/ch/{nn}/config/source` - Input source (0-63)
- `/ch/{nn}/preamp/trim` - Preamp gain (0.0-1.0)
- `/ch/{nn}/preamp/hpon` - High-pass filter on (0/1)
- `/ch/{nn}/preamp/hpf` - High-pass filter frequency (0.0-1.0)

#### Channel Mix
- `/ch/{nn}/mix/solo` - Solo channel (0/1)
- `/ch/{nn}/mix/st` - Send to stereo (0.0-1.0)
- `/ch/{nn}/mix/mlevel` - Monitor level (0.0-1.0)

#### Insert Effects
- `/ch/{nn}/insert/on` - Insert effect on (0/1)
- `/ch/{nn}/insert/pos` - Insert position (0-3)

#### Bus Configuration
- `/bus/{nn}/config/name` - Bus name (string)
- `/bus/{nn}/config/color` - Bus color (0-15)
- `/bus/{nn}/config/mono` - Mono bus (0/1)

#### Effects
- `/fx/{nn}/on` - Effect on (0/1)
- `/fx/{nn}/mix` - Effect mix (0.0-1.0)
- `/fx/{nn}/par/{nn}` - Effect parameter (0.0-1.0)

#### Matrix
- `/mtx/{nn}/config/name` - Matrix name (string)
- `/mtx/{nn}/config/color` - Matrix color (0-15)

#### System
- `/-stat/talk` - Talkback (0/1)
- `/-stat/solosw` - Solo switch (no value)
- `/-stat/rtn` - Return solo (0/1)

**Note**: Replace `{nn}` with zero-padded channel/bus/effect numbers (e.g., `01`, `02`, `15`).

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

## X32 OSC Protocol Reference

This MCP server implements the official Behringer X32 OSC Remote Protocol. For advanced usage and complete OSC command reference, refer to the official [Behringer X32 OSC Remote Protocol documentation](behringer-x32-x32-osc-remote-protocol-en-44463.pdf) (included in this repository).

The server implements all major protocol features including:
- Channel controls (32 input channels)
- Bus controls (16 mix buses)
- Matrix controls (6 matrix outputs)
- Effects (8 effect slots)
- DCA groups (8 groups)
- Headamps (128 inputs including AES50)
- Output routing (Main, Aux, P16, AES, REC)
- Scenes (100 scenes)
- System controls (Info, XControl, Talkback)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
