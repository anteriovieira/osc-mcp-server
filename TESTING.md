# Testing Guide - X32 OSC MCP Server

This guide explains how to test the X32 OSC MCP server using an X32 emulator or the physical Behringer X32 mixer.

## Overview

You can test the MCP server with either:

1. **Physical Behringer X32 Mixer**: Connect your computer to the X32 on the same network
2. **X32 Emulator**: Use an emulator application to simulate the X32 mixer

### Using the X32 Emulator

If you don't have access to a physical X32 mixer, you can use an emulator:

1.  **Install and Run the Emulator**: Download and run the X32 emulator (available in the `emulator/` directory)
2.  **Configure the Emulator**:
    *   Ensure the emulator is running and listening for OSC commands
    *   Note the IP address and Port the emulator is using (usually UDP port 10023)
3.  **Configure the MCP Server**:
    *   Update your `claude_desktop_config.json` to point to the emulator's IP and Port

## Configuration

Edit your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add or update the configuration:

```json
{
  "mcpServers": {
    "osc": {
      "command": "node",
      "args": [
        "/path/to/osc-mcp/dist/index.js"
      ],
      "env": {
        "OSC_HOST": "127.0.0.1", // Or the IP of your emulator
        "OSC_PORT": "10023"      // The port your emulator is listening on
      }
    }
  }
}
```

## Running Tests

You can run the connection test script to verify connectivity to the emulator:

```bash
npm test
```

This will attempt to connect to the Behringer X32 mixer (or emulator) at the configured address and perform basic operations.

## Manual Testing

Once connected, you can use Claude Desktop to control the emulator. Try commands like:

*   "Set channel 1 fader to 75%"
*   "Mute channel 3"
*   "Pan channel 2 to the left"

Verify the changes are reflected in the emulator's interface.
