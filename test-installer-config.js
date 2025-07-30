#!/usr/bin/env node

/**
 * Installer Configuration Test Script
 * Symbiotic Analysis Environment
 * 
 * This script validates the installer configuration and setup
 * without requiring a full build (useful when Rust is not installed)
 */

const fs = require('fs');
const path = require('path');

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${type}] ${timestamp} - ${message}`);
}

function testFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✓ ${description}: ${filePath}`, 'PASS');
    return true;
  } else {
    log(`✗ ${description}: ${filePath}`, 'FAIL');
    return false;
  }
}

function testJsonConfig(filePath, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    log(`✓ ${description}: Valid JSON configuration`, 'PASS');
    return config;
  } catch (error) {
    log(`✗ ${description}: Invalid JSON - ${error.message}`, 'FAIL');
    return null;
  }
}

function validateTauriConfig() {
  log('Validating Tauri configuration...');
  
  const configPath = 'src-tauri/tauri.conf.json';
  const config = testJsonConfig(configPath, 'Tauri configuration');
  
  if (!config) return false;

  const checks = [
    { path: 'productName', expected: 'Symbiotic Analysis Environment' },
    { path: 'version', expected: '0.1.0' },
    { path: 'identifier', expected: 'com.symbiotic-analysis.app' },
    { path: 'bundle.active', expected: true },
    { path: 'bundle.targets', expected: 'all' }
  ];

  let allValid = true;
  
  for (const check of checks) {
    const value = getNestedValue(config, check.path);
    if (value === check.expected) {
      log(`✓ ${check.path}: ${value}`, 'PASS');
    } else {
      log(`✗ ${check.path}: Expected "${check.expected}", got "${value}"`, 'FAIL');
      allValid = false;
    }
  }

  // Check bundle formats
  const bundleConfig = config.bundle;
  if (bundleConfig) {
    const platforms = ['windows', 'macOS', 'linux'];
    for (const platform of platforms) {
      if (bundleConfig[platform]) {
        log(`✓ ${platform} bundle configuration present`, 'PASS');
      } else {
        log(`✗ ${platform} bundle configuration missing`, 'FAIL');
        allValid = false;
      }
    }
  }

  return allValid;
}

function validatePackageJson() {
  log('Validating package.json configuration...');
  
  const configPath = 'package.json';
  const config = testJsonConfig(configPath, 'Package.json');
  
  if (!config) return false;

  const requiredScripts = [
    'dev', 'build', 'tauri:dev', 'tauri:build', 'build:installers'
  ];

  let allValid = true;
  
  for (const script of requiredScripts) {
    if (config.scripts && config.scripts[script]) {
      log(`✓ Script "${script}": ${config.scripts[script]}`, 'PASS');
    } else {
      log(`✗ Script "${script}": Missing`, 'FAIL');
      allValid = false;
    }
  }

  return allValid;
}

function validateProjectStructure() {
  log('Validating project structure...');
  
  const requiredFiles = [
    { path: 'src-tauri/Cargo.toml', desc: 'Rust project configuration' },
    { path: 'src-tauri/src/main.rs', desc: 'Rust main entry point' },
    { path: 'src-tauri/src/lib.rs', desc: 'Rust library configuration' },
    { path: 'index.html', desc: 'Frontend entry point' },
    { path: 'main.js', desc: 'Frontend JavaScript' },
    { path: 'vite.config.js', desc: 'Frontend build configuration' },
    { path: 'build-installers.js', desc: 'Build automation script' },
    { path: 'INSTALLER_SETUP.md', desc: 'Setup documentation' }
  ];

  const requiredDirs = [
    { path: 'src-tauri/icons', desc: 'Application icons directory' },
    { path: 'src-tauri/src', desc: 'Rust source directory' }
  ];

  let allValid = true;

  for (const file of requiredFiles) {
    if (!testFileExists(file.path, file.desc)) {
      allValid = false;
    }
  }

  for (const dir of requiredDirs) {
    if (!testFileExists(dir.path, dir.desc)) {
      allValid = false;
    }
  }

  return allValid;
}

function validateIcons() {
  log('Validating application icons...');
  
  const iconDir = 'src-tauri/icons';
  const requiredIcons = [
    '32x32.png',
    '128x128.png', 
    '128x128@2x.png',
    'icon.ico',
    'icon.icns',
    'icon.png'
  ];

  let allValid = true;

  for (const icon of requiredIcons) {
    const iconPath = path.join(iconDir, icon);
    if (!testFileExists(iconPath, `Icon: ${icon}`)) {
      allValid = false;
    }
  }

  return allValid;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function main() {
  log('Starting installer configuration validation...');
  log('='.repeat(60));

  const tests = [
    { name: 'Project Structure', fn: validateProjectStructure },
    { name: 'Tauri Configuration', fn: validateTauriConfig },
    { name: 'Package.json Configuration', fn: validatePackageJson },
    { name: 'Application Icons', fn: validateIcons }
  ];

  let allPassed = true;
  const results = [];

  for (const test of tests) {
    log(`\nRunning: ${test.name}`);
    log('-'.repeat(40));
    
    const passed = test.fn();
    results.push({ name: test.name, passed });
    
    if (!passed) {
      allPassed = false;
    }
  }

  log('\n' + '='.repeat(60));
  log('VALIDATION SUMMARY');
  log('='.repeat(60));

  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    log(`${status} - ${result.name}`);
  }

  log('\n' + '='.repeat(60));
  
  if (allPassed) {
    log('🎉 All validation tests passed!', 'SUCCESS');
    log('The installer configuration is ready for building.');
    log('Next steps:');
    log('1. Install Rust: https://rustup.rs/');
    log('2. Run: npm run build:installers');
  } else {
    log('❌ Some validation tests failed.', 'ERROR');
    log('Please fix the issues above before proceeding.');
  }

  return allPassed;
}

// Run the validation
if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = { main, validateTauriConfig, validatePackageJson, validateProjectStructure, validateIcons };
