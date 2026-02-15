# Installation Guide: Coding Brain CLI v3.0

## Prerequisites
- **Node.js**: v18 or higher (if installing via NPM)
- **Git**: For cloning the repository (if building from source)

## Option 1: Install via NPM (Recommended)
The easiest way to install the CLI is via NPM. This works on Windows, macOS, and Linux.

```bash
npm install -g @coding-brain/cli
```

Verify the installation:
```bash
brain --version
```

## Option 2: Standalone Binaries
If you don't have Node.js installed, you can download the standalone executable for your operating system from the [Releases](https://github.com/coding-brain/cli/releases) page.

### Windows
1. Download `brain.exe`.
2. Add the directory containing `brain.exe` to your PATH.
3. Run `brain --help` in PowerShell or Command Prompt.

### macOS
1. Download `brain-macos`.
2. Make it executable: `chmod +x brain-macos`.
3. Move it to your path: `mv brain-macos /usr/local/bin/brain`.
4. Run `brain --help`.

### Linux
1. Download `brain-linux`.
2. Make it executable: `chmod +x brain-linux`.
3. Move it to your path: `mv brain-linux /usr/local/bin/brain`.
4. Run `brain --help`.

## Option 3: Build from Source
1. Clone the repository:
   ```bash
   git clone https://github.com/coding-brain/cli.git
   cd cli
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the binary for your OS:
   - **Windows**: `npm run build:win`
   - **Linux**: `npm run build:linux`
   - **macOS**: `npm run build:mac`

The binary will be created in the `dist/` folder.

## Troubleshooting
- **"command not found"**: Ensure your global NPM bin folder is in your PATH.
- **Permission errors (macOS/Linux)**: You may need to run commands with `sudo` or adjust directory permissions.
- **Windows SmartScreen**: If you see a warning on Windows, click "More info" > "Run anyway". We are working on EV Code Signing to resolve this.
