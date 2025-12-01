# Changelog

## Documentation Updates - X32 Focus

All documentation has been updated to specifically focus on the Behringer X32 digital mixer, removing generic references to "digital mixers" and clarifying that this MCP server is designed specifically for the X32.

### Updated Files

- **README.md**: Updated title, description, and all references to focus specifically on Behringer X32
- **PROMPT.md**: Updated system prompt to be X32-specific, corrected EQ bands to 6 (was 4)
- **AGENTS.md**: Updated agent configuration guide with X32-specific references
- **INSTALLATION.md**: Updated installation instructions for X32 focus
- **QUICKSTART.md**: Updated quick start guide for X32
- **TESTING.md**: Updated testing guide for X32 emulator and physical mixer
- **package.json**: Updated description and keywords to focus on X32
- **claude_desktop_config.json**: Updated example configuration with better naming
- **src/index.ts**: Updated server name and log messages to "X32 OSC MCP Server"

### Key Changes

1. **Title Updates**: All titles now specify "X32 OSC MCP Server" or "Behringer X32"
2. **Removed Generic References**: Removed mentions of "digital mixers" and generic references
3. **Clarified Compatibility**: Made it clear this is optimized for Behringer X32 specifically
4. **EQ Bands**: Corrected documentation to show 6-band EQ (was incorrectly showing 4)
5. **Tool Count**: Updated to reflect 97 tools (was 50+)
6. **Protocol Reference**: Added reference to the official X32 OSC protocol document included in repository

### Technical Updates

- Server name changed from "osc-mcp" to "x32-osc-mcp"
- All log messages now reference "X32 OSC MCP Server" and "Behringer X32"
- Configuration examples updated to use "x32-osc" as server identifier
- Added reference to official Behringer X32 OSC protocol document

