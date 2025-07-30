# Symbiotic Analysis Environment

A local-first, AI-powered data analysis environment built with Tauri and modern web technologies.

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v16+): [Download here](https://nodejs.org/)
2. **Rust**: [Install via rustup](https://rustup.rs/)
3. **Platform-specific tools** (see [INSTALLER_SETUP.md](INSTALLER_SETUP.md))

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start Tauri development mode
npm run tauri:dev
```

### Building Installers

```bash
# Test configuration (no Rust required)
npm run test:config

# Build all platform installers
npm run build:installers

# Manual build
npm run build && npm run tauri:build
```

## 📦 Supported Platforms

- **Windows**: NSIS (.exe) and MSI (.msi) installers
- **macOS**: DMG (.dmg) and PKG (.pkg) packages
- **Linux**: DEB (.deb), RPM (.rpm), and AppImage (.appimage) packages

## 🏗️ Project Structure

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
├── test-installer-config.js  # Configuration validator
├── vite.config.js            # Frontend build configuration
├── INSTALLER_SETUP.md        # Detailed setup guide
└── README.md                 # This file
```

## 🔧 Configuration

The application is configured through:

- **`src-tauri/tauri.conf.json`**: Main Tauri configuration including bundling options
- **`package.json`**: Node.js dependencies and build scripts
- **`src-tauri/Cargo.toml`**: Rust dependencies and metadata

## 🧪 Testing

```bash
# Validate installer configuration
npm run test:config

# Test build process (requires Rust)
npm run test:installers
```

## 📚 Documentation

- **[INSTALLER_SETUP.md](INSTALLER_SETUP.md)**: Comprehensive setup and build guide
- **[Tauri Documentation](https://v2.tauri.app/)**: Official Tauri v2 documentation

## 🎯 Current Status

**Phase 1: Core Application Shell & UX**
- ✅ Cross-platform installer setup (Story 1.1)
- 🔄 Additional features in development

## 🤝 Contributing

This project follows the BMad-Method development framework. See the `.bmad-core/` directory for development guidelines and agent configurations.

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Links

- **Project Repository**: [GitHub](https://github.com/symbiotic-analysis/environment)
- **Issue Tracker**: [GitHub Issues](https://github.com/symbiotic-analysis/environment/issues)
- **Documentation**: [Project Wiki](https://github.com/symbiotic-analysis/environment/wiki)

---

**Built with ❤️ using Tauri, Rust, and modern web technologies.**
