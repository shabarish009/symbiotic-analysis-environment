#!/usr/bin/env node

/**
 * Cross-Platform Installer Build Script
 * Symbiotic Analysis Environment
 * 
 * This script automates the building of installers for Windows, macOS, and Linux
 * using Tauri's built-in bundling capabilities.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  appName: 'Symbiotic Analysis Environment',
  version: '0.1.0',
  outputDir: 'src-tauri/target/release/bundle',
  platforms: {
    windows: ['msi', 'nsis'],
    macos: ['dmg', 'app'],
    linux: ['deb', 'rpm', 'appimage']
  }
};

// Utility functions
function log(message) {
  console.log(`[BUILD] ${new Date().toISOString()} - ${message}`);
}

function executeCommand(command, description) {
  log(`Starting: ${description}`);
  try {
    const output = execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
      timeout: 300000 // 5 minute timeout
    });
    log(`Completed: ${description}`);
    return true;
  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      log(`Failed: ${description} - Command timed out after 5 minutes`);
    } else if (error.status) {
      log(`Failed: ${description} - Process exited with code ${error.status}`);
    } else {
      log(`Failed: ${description} - ${error.message}`);
    }
    return false;
  }
}

function checkPrerequisites() {
  log('Checking build prerequisites...');
  
  const requirements = [
    { command: 'node --version', name: 'Node.js' },
    { command: 'npm --version', name: 'npm' },
    { command: 'rustc --version', name: 'Rust' },
    { command: 'cargo --version', name: 'Cargo' }
  ];

  let allMet = true;
  
  for (const req of requirements) {
    try {
      execSync(req.command, { stdio: 'pipe' });
      log(`✓ ${req.name} is available`);
    } catch (error) {
      log(`✗ ${req.name} is missing or not in PATH`);
      allMet = false;
    }
  }

  return allMet;
}

function buildFrontend() {
  return executeCommand('npm run build', 'Building frontend assets');
}

function buildTauriApp() {
  return executeCommand('npm run tauri:build', 'Building Tauri application and installers');
}

function listGeneratedInstallers() {
  log('Listing generated installer packages...');

  try {
    if (!fs.existsSync(config.outputDir)) {
      log('Output directory does not exist. Build may have failed.');
      return;
    }

    const platforms = fs.readdirSync(config.outputDir);

    if (platforms.length === 0) {
      log('No installer packages found in output directory.');
      return;
    }

    for (const platform of platforms) {
      const platformDir = path.join(config.outputDir, platform);
      try {
        if (fs.statSync(platformDir).isDirectory()) {
          log(`\n${platform.toUpperCase()} Installers:`);
          const files = fs.readdirSync(platformDir);

          if (files.length === 0) {
            log(`  - No files found in ${platform} directory`);
            continue;
          }

          for (const file of files) {
            const filePath = path.join(platformDir, file);
            try {
              const stats = fs.statSync(filePath);
              const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
              log(`  - ${file} (${sizeInMB} MB)`);
            } catch (fileError) {
              log(`  - ${file} (size unknown - ${fileError.message})`);
            }
          }
        }
      } catch (dirError) {
        log(`Error reading platform directory ${platform}: ${dirError.message}`);
      }
    }
  } catch (error) {
    log(`Error listing installers: ${error.message}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const isTestMode = args.includes('--test');

  if (isTestMode) {
    log('Running in test mode - checking prerequisites only');
    const prereqsMet = checkPrerequisites();
    if (prereqsMet) {
      log('✅ All prerequisites met - ready for building');
      process.exit(0);
    } else {
      log('❌ Prerequisites not met');
      process.exit(1);
    }
  }

  log(`Starting cross-platform build for ${config.appName} v${config.version}`);

  // Check prerequisites
  if (!checkPrerequisites()) {
    log('Prerequisites not met. Please install missing requirements.');
    log('Installation guide: https://tauri.app/v1/guides/getting-started/prerequisites');
    process.exit(1);
  }

  // Build frontend
  if (!buildFrontend()) {
    log('Frontend build failed. Aborting.');
    process.exit(1);
  }

  // Build Tauri app and installers
  if (!buildTauriApp()) {
    log('Tauri build failed. Check the error messages above.');
    process.exit(1);
  }

  // List generated installers
  listGeneratedInstallers();

  log('Build process completed successfully!');
  log(`Installers are available in: ${config.outputDir}`);
}

// Run the build process
if (require.main === module) {
  main();
}

module.exports = { config, checkPrerequisites, buildFrontend, buildTauriApp };
