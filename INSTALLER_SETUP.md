# Cross-Platform Installer Setup Guide
## Symbiotic Analysis Environment

This document provides comprehensive instructions for setting up and building cross-platform installers for the Symbiotic Analysis Environment using Tauri.

## Prerequisites

### Required Software

1. **Node.js** (v16 or later)
   - Download from: https://nodejs.org/
   - Verify: `node --version`

2. **Rust** (latest stable)
   - Install via rustup: https://rustup.rs/
   - Verify: `rustc --version` and `cargo --version`

3. **Platform-Specific Tools**

   **Windows:**
   - Visual Studio Build Tools or Visual Studio Community
   - Windows SDK
   - Optional: Code signing certificate for production releases

   **macOS:**
   - Xcode Command Line Tools: `xcode-select --install`
   - For distribution: Apple Developer account and certificates

   **Linux:**
   - Build essentials: `sudo apt install build-essential`
   - Additional packages: `sudo apt install libwebkit2gtk-4.0-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

## Project Structure

```
project/
├── src-tauri/                 # Rust backend
│   ├── tauri.conf.json       # Tauri configuration
│   ├── Cargo.toml            # Rust dependencies
│   ├── src/                  # Rust source code
│   └── icons/                # Application icons
├── dist/                     # Built frontend assets
├── index.html                # Frontend entry point
├── main.js                   # Frontend JavaScript
├── package.json              # Node.js configuration
├── build-installers.js       # Build automation script
└── vite.config.js            # Frontend build configuration
```

## Configuration

### Tauri Configuration (src-tauri/tauri.conf.json)

The installer configuration is defined in the `bundle` section:

- **Windows**: NSIS (.exe) and MSI (.msi) installers
- **macOS**: DMG (.dmg) and PKG (.pkg) packages  
- **Linux**: DEB (.deb), RPM (.rpm), and AppImage (.appimage) packages

Key configuration features:
- Application metadata (name, version, description)
- Publisher information and copyright
- Platform-specific installer options
- Dependency bundling configuration
- Uninstaller generation

### Build Scripts

Available npm scripts:
- `npm run dev` - Start development server
- `npm run build` - Build frontend assets
- `npm run tauri:dev` - Start Tauri development mode
- `npm run tauri:build` - Build production installers

## Building Installers

### Automated Build Process

Use the provided build script for automated cross-platform building:

```bash
node build-installers.js
```

This script will:
1. Check all prerequisites
2. Build frontend assets
3. Build Tauri application
4. Generate platform-specific installers
5. List all generated packages

### Manual Build Process

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build frontend:**
   ```bash
   npm run build
   ```

3. **Build installers:**
   ```bash
   npm run tauri:build
   ```

### Output Locations

Generated installers will be available in:
```
src-tauri/target/release/bundle/
├── nsis/          # Windows NSIS installer (.exe)
├── msi/           # Windows MSI installer (.msi)
├── dmg/           # macOS DMG package (.dmg)
├── macos/         # macOS app bundle (.app)
├── deb/           # Linux Debian package (.deb)
├── rpm/           # Linux RPM package (.rpm)
└── appimage/      # Linux AppImage (.AppImage)
```

## Platform-Specific Notes

### Windows
- NSIS installer provides the most user-friendly installation experience
- MSI installer integrates better with enterprise deployment tools
- Code signing recommended for production releases to avoid security warnings

### macOS
- DMG provides drag-and-drop installation experience
- Code signing and notarization required for distribution outside App Store
- Minimum macOS version: 10.13 (High Sierra)

### Linux
- DEB packages for Debian/Ubuntu-based distributions
- RPM packages for Red Hat/Fedora-based distributions
- AppImage provides universal Linux compatibility
- No root privileges required for AppImage installation

## Testing Installation

### Windows
1. Run the generated .exe or .msi installer
2. Verify application appears in Start Menu
3. Test application launch
4. Test uninstaller functionality

### macOS
1. Mount the .dmg file
2. Drag application to Applications folder
3. Test application launch from Applications
4. Verify application can be removed by dragging to Trash

### Linux
1. Install package using appropriate package manager:
   - DEB: `sudo dpkg -i package.deb`
   - RPM: `sudo rpm -i package.rpm`
   - AppImage: `chmod +x package.AppImage && ./package.AppImage`
2. Test application launch
3. Verify package removal works correctly

## Troubleshooting

### Common Issues

1. **"program not found" errors**
   - Ensure Rust is installed and in PATH
   - Restart terminal after installing Rust

2. **Build failures on Windows**
   - Install Visual Studio Build Tools
   - Ensure Windows SDK is available

3. **Permission errors on macOS**
   - Install Xcode Command Line Tools
   - Check file permissions in project directory

4. **Missing dependencies on Linux**
   - Install required development packages
   - Check distribution-specific requirements

### Debug Mode

For debugging build issues, use:
```bash
TAURI_DEBUG=1 npm run tauri:build
```

This provides verbose output for troubleshooting build problems.

## Production Considerations

### Code Signing
- **Windows**: Use SignTool with valid certificate
- **macOS**: Use Apple Developer certificate and notarization
- **Linux**: Optional GPG signing for package repositories

### Distribution
- **Windows**: Microsoft Store, direct download, or enterprise deployment
- **macOS**: App Store, direct download, or enterprise deployment  
- **Linux**: Package repositories, direct download, or software centers

### Updates
- Consider implementing auto-update functionality using Tauri's updater
- Plan update strategy for different distribution channels
- Test update process thoroughly across all platforms
