import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ESP32 Konfiguration (in Bytes)
const ESP32_CONFIGS = {
  '4MB': 4 * 1024 * 1024,
  '8MB': 8 * 1024 * 1024,
  '16MB': 16 * 1024 * 1024,
};

// Standardmäßig 4MB Flash, davon ~2.8MB für SPIFFS nutzbar
const SPIFFS_SIZE = 2.8 * 1024 * 1024;

// PlatformIO partition schemes und ihre SPIFFS Größen
const PARTITION_SCHEMES = {
  'default': { total: 4 * 1024 * 1024, fs: 1.5 * 1024 * 1024 },
  'default_8MB': { total: 8 * 1024 * 1024, fs: 1.5 * 1024 * 1024 },
  'default_16MB': { total: 16 * 1024 * 1024, fs: 1.5 * 1024 * 1024 },
  'minimal': { total: 4 * 1024 * 1024, fs: 1.9 * 1024 * 1024 },
  'no_ota': { total: 4 * 1024 * 1024, fs: 2 * 1024 * 1024 },
  'huge_app': { total: 4 * 1024 * 1024, fs: 0.5 * 1024 * 1024 },
  'min_spiffs': { total: 4 * 1024 * 1024, fs: 1.5 * 1024 * 1024 },
  'fatflash': { total: 4 * 1024 * 1024, fs: 3 * 1024 * 1024 },
  'app3M_fat9M_16MB': { total: 16 * 1024 * 1024, fs: 9 * 1024 * 1024 },
};

function parsePlatformIO(platformIniPath = './platformio.ini') {
  if (!fs.existsSync(platformIniPath)) {
    console.log(`⚠️  platformio.ini not found at: ${platformIniPath}`);
    return null;
  }

  const content = fs.readFileSync(platformIniPath, 'utf-8');
  const lines = content.split('\n');

  let flashSize = null;
  let partitionScheme = null;
  let board = null;
  let currentEnv = null;
  let filesystem = 'LittleFS'; // Default (empfohlen für ESP32)

  lines.forEach(line => {
    line = line.trim();

    // Umgebung erkennen
    if (line.startsWith('[env:')) {
      currentEnv = line.match(/\[env:(.*)\]/)?.[1];
    }

    // Board erkennen
    if (line.startsWith('board =')) {
      board = line.split('=')[1].trim();
    }

    // Flash Size aus board_build.flash_size
    if (line.startsWith('board_build.flash_size')) {
      const match = line.match(/board_build\.flash_size\s*=\s*(\d+)MB/i);
      if (match) {
        flashSize = parseInt(match[1]);
      }
    }

    // Partition Scheme
    if (line.startsWith('board_build.partitions')) {
      partitionScheme = line.split('=')[1].trim();
      // Entferne .csv wenn vorhanden
      partitionScheme = partitionScheme.replace('.csv', '');
    }

    // Filesystem Type
    if (line.startsWith('board_build.filesystem')) {
      const fs = line.split('=')[1].trim().toUpperCase();
      // Erkenne SPIFFS, LittleFS, FATFS
      if (fs.includes('LITTLEFS')) {
        filesystem = 'LittleFS';
      } else if (fs.includes('FATFS') || fs.includes('FAT')) {
        filesystem = 'FATFS';
      } else if (fs.includes('SPIFFS')) {
        filesystem = 'SPIFFS';
      }
    }
  });

  return { flashSize, partitionScheme, board, currentEnv, filesystem };
}

function getFSSize(platformIOConfig) {
  if (!platformIOConfig) {
    return SPIFFS_SIZE;
  }

  const { flashSize, partitionScheme, board } = platformIOConfig;

  // Wenn Partition Scheme definiert ist, verwende das
  if (partitionScheme && PARTITION_SCHEMES[partitionScheme]) {
    return PARTITION_SCHEMES[partitionScheme].fs;
  }

  // Fallback basierend auf Flash Size
  if (flashSize) {
    // Standardmäßig ~50-70% für FS bei custom sizes
    return flashSize * 1024 * 1024 * 0.6;
  }

  // Board-basierte Defaults
  if (board) {
    if (board.includes('16m')) return 9 * 1024 * 1024;
    if (board.includes('8m')) return 5 * 1024 * 1024;
  }

  return SPIFFS_SIZE;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDirectorySize(dirPath) {
  let totalSize = 0;
  const files = {};
  const ignoredFiles = [];

  function shouldIgnoreFile(filename) {
    const ignorePatterns = [
      /\.map$/i,           // Source maps (.js.map, .css.map)
      /\.DS_Store$/i,      // macOS
      /Thumbs\.db$/i,      // Windows
      /desktop\.ini$/i,    // Windows
    ];

    return ignorePatterns.some(pattern => pattern.test(filename));
  }

  function scanDirectory(currentPath) {
    const items = fs.readdirSync(currentPath);

    items.forEach(item => {
      const fullPath = path.join(currentPath, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        scanDirectory(fullPath);
      } else {
        // Ignoriere bestimmte Dateien
        if (shouldIgnoreFile(item)) {
          ignoredFiles.push(item);
          return;
        }

        totalSize += stats.size;
        const ext = path.extname(item).toLowerCase() || 'no-ext';
        files[ext] = (files[ext] || 0) + stats.size;
      }
    });
  }

  if (fs.existsSync(dirPath)) {
    scanDirectory(dirPath);
  }

  return { totalSize, files, ignoredFiles };
}

function analyzeESP32Storage(distPath = './dist', platformIniPath = './platformio.ini') {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║        ESP32 Storage Analyzer                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // PlatformIO Config auslesen
  const platformIOConfig = parsePlatformIO(platformIniPath);
  const fsSize = getFSSize(platformIOConfig);
  const fsType = platformIOConfig?.filesystem || 'FS';

  // PlatformIO Info anzeigen
  if (platformIOConfig) {
    console.log('⚙️  PlatformIO Configuration:');
    console.log('─────────────────────────────────────────────────────────');
    if (platformIOConfig.currentEnv) {
      console.log(`  Environment:    ${platformIOConfig.currentEnv}`);
    }
    if (platformIOConfig.board) {
      console.log(`  Board:          ${platformIOConfig.board}`);
    }
    if (platformIOConfig.flashSize) {
      console.log(`  Flash Size:     ${platformIOConfig.flashSize}MB`);
    }
    if (platformIOConfig.partitionScheme) {
      console.log(`  Partition:      ${platformIOConfig.partitionScheme}`);
    }
    console.log(`  Filesystem:     ${platformIOConfig.filesystem}`);
    console.log(`  FS Size:        ${formatBytes(fsSize)} (detected)\n`);
  } else {
    console.log(`⚠️  Using default FS size: ${formatBytes(fsSize)}\n`);
  }

  const { totalSize, files, ignoredFiles } = getDirectorySize(distPath);

  console.log(`📁 Analyzing: ${path.resolve(distPath)}\n`);

  // Ignorierte Dateien anzeigen
  if (ignoredFiles.length > 0) {
    console.log('🚫 Ignored files (not uploaded to ESP32):');
    console.log('─────────────────────────────────────────────────────────');
    ignoredFiles.forEach(file => {
      console.log(`  ⊗ ${file}`);
    });
    console.log('');
  }

  // Dateigrößen nach Typ
  console.log('📊 File sizes by type:');
  console.log('─────────────────────────────────────────────────────────');
  Object.entries(files)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ext, size]) => {
      const percentage = ((size / totalSize) * 100).toFixed(1);
      console.log(`  ${ext.padEnd(10)} ${formatBytes(size).padEnd(12)} (${percentage}%)`);
    });

  console.log('─────────────────────────────────────────────────────────');
  console.log(`  Total:     ${formatBytes(totalSize)}\n`);

  // Filesystem Analyse
  const usedPercentage = ((totalSize / fsSize) * 100).toFixed(2);
  const remainingSpace = fsSize - totalSize;
  const remainingPercentage = ((remainingSpace / fsSize) * 100).toFixed(2);

  console.log(`💾 ESP32 ${fsType} Status:`);
  console.log('─────────────────────────────────────────────────────────');
  console.log(`  ${fsType} Size:     ${formatBytes(fsSize)}`);
  console.log(`  Used:           ${formatBytes(totalSize)} (${usedPercentage}%)`);
  console.log(`  Free:           ${formatBytes(remainingSpace)} (${remainingPercentage}%)`);

  // Visuelle Progress Bar
  const barLength = 40;
  const filledLength = Math.round((totalSize / fsSize) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

  console.log(`\n  [${bar}] ${usedPercentage}%\n`);

  // Warnung wenn > 80% voll
  if (usedPercentage > 90) {
    console.log(`🚨 CRITICAL: ${fsType} is more than 90% full!`);
  } else if (usedPercentage > 80) {
    console.log(`⚠️  WARNING: ${fsType} is more than 80% full!`);
  } else {
    console.log('✅ Storage usage is healthy');
  }

  // Alternative ESP32 Konfigurationen
  console.log('\n📦 Alternative ESP32 configurations:');
  console.log('─────────────────────────────────────────────────────────');
  Object.entries(ESP32_CONFIGS).forEach(([config, size]) => {
    const fs = size * 0.7; // ~70% für FS
    const percentage = ((totalSize / fs) * 100).toFixed(2);
    console.log(`  ${config.padEnd(8)} ${formatBytes(fs).padEnd(12)} → ${percentage}% used`);
  });

  console.log('\n');
}

// CLI Ausführung
const distPath = process.argv[2] || './dist';
const platformIniPath = process.argv[3] || './platformio.ini';

analyzeESP32Storage(distPath, platformIniPath);
