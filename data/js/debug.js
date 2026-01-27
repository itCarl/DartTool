// ============================================================================
// DEBUG PAGE - SERVO AND LASER FUNCTIONS
// ============================================================================

import { byId, on } from './utils.js';
import { sendMessage, ws } from './network.js';
import { host } from './settings.js';

// Servo command definitions
const ServoCommands = {
    SET_POSITION: {
        cmd: 'setServo',
        buildParams: (position) => ({ pos: parseInt(position) }),
        getMessage: (position) => `Sende Befehl: Position ${position}°...`
    },
    SET_BY_DISTANCE: {
        cmd: 'setServoByDistance',
        buildParams: (distance, height) => ({
            dis: parseInt(distance),
            height: parseInt(height)
        }),
        getMessage: (distance, height) => `Berechne Winkel für Höhe ${height} cm und Distanz ${distance} cm...`
    },
    SEQUENCE: {
        cmd: 'servoSequence',
        buildParams: (sequence) => ({ seq: sequence }),
        getMessage: (sequence) => `Starte Sequenz ${sequence}...`
    },
    INIT: {
        cmd: 'initServo',
        buildParams: () => ({}),
        getMessage: () => 'Initialisiere Servo...'
    }
};

// Laser command definitions
const LaserCommands = {
    ON: {
        cmd: 'laserControl',
        buildParams: () => ({ action: 'on' }),
        getMessage: () => 'Laser wird eingeschaltet...'
    },
    OFF: {
        cmd: 'laserControl',
        buildParams: () => ({ action: 'off' }),
        getMessage: () => 'Laser wird ausgeschaltet...'
    },
    TOGGLE: {
        cmd: 'laserControl',
        buildParams: () => ({ action: 'toggle' }),
        getMessage: () => 'Laser Status wird umgeschaltet...'
    }
};

function sendServoCommand(commandConfig, ...args) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        updateStatus('Nicht verbunden', 'error');
        return false;
    }

    const cmd = {
        cmd: commandConfig.cmd,
        ...commandConfig.buildParams(...args)
    };

    sendMessage(cmd);
    updateStatus(commandConfig.getMessage(...args), 'info');
    return true;
}

function sendLaserCommand(commandConfig) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        updateStatus('Nicht verbunden', 'error');
        return false;
    }

    const cmd = {
        cmd: commandConfig.cmd,
        ...commandConfig.buildParams()
    };

    sendMessage(cmd);
    updateStatus(commandConfig.getMessage(), 'info');
    return true;
}

function updateCurrentPosition(pos) {
    const el = byId('currentServoPos');
    if (el) el.textContent = pos + '°';
}

function updateLaserStatus(state) {
    const el = byId('laserStatus');
    if (el) el.textContent = state ? 'EIN' : 'AUS';
}

function updateStatus(message, type = 'info') {
    const display = byId('statusDisplay');
    if (!display) return;

    const timestamp = new Date().toLocaleTimeString('de-DE');

    let prefix = '[info]';
    let color = '';
    if (type === 'success') {
        prefix = '[ok]';
        color = 'color: #4caf50;';
    } else if (type === 'error') {
        prefix = '[err]';
        color = 'color: #f44336;';
    }

    display.innerHTML = `<p class="small" style="${color}"><strong>${prefix} ${timestamp}</strong>: ${message}</p>` + display.innerHTML;

    const messages = display.querySelectorAll('p');
    if (messages.length > 5) {
        messages[messages.length - 1].remove();
    }
}

function initDebugPage() {
    const servoSlider = byId('servoSlider');
    const servoSliderValue = byId('servoSliderValue');
    const setServoBtn = byId('setServoBtn');
    const servoHeightValue = byId('height');
    const servoDistanceValue = byId('distance');
    const setDistanceBtn = byId('setDistance');

    if (servoSlider) {
        servoSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            if (servoSliderValue) servoSliderValue.textContent = `Wert: ${value}°`;
            updateCurrentPosition(value);
        });
    }

    if (setServoBtn) {
        setServoBtn.addEventListener('click', () => {
            const position = servoSlider?.value;
            if (position) sendServoCommand(ServoCommands.SET_POSITION, position);
        });
    }

    if (setDistanceBtn) {
        setDistanceBtn.addEventListener('click', () => {
            const distance = servoDistanceValue?.value;
            const height = servoHeightValue?.value;
            if (distance && height) sendServoCommand(ServoCommands.SET_BY_DISTANCE, distance, height);
        });
    }

    const presets = [0, 45, 90, 135, 180];
    presets.forEach(pos => {
        const btn = byId(`servo${pos}`);
        if (btn) {
            btn.addEventListener('click', () => {
                if (servoSlider) servoSlider.value = pos;
                if (servoSliderValue) servoSliderValue.textContent = `Wert: ${pos}°`;
                updateCurrentPosition(pos);
                sendServoCommand(ServoCommands.SET_POSITION, pos);
            });
        }
    });

    const testSeq1 = byId('testSeq1');
    const testSeq2 = byId('testSeq2');
    const testSeq3 = byId('testSeq3');

    if (testSeq1) testSeq1.addEventListener('click', () => sendServoCommand(ServoCommands.SEQUENCE, 1));
    if (testSeq2) testSeq2.addEventListener('click', () => sendServoCommand(ServoCommands.SEQUENCE, 2));
    if (testSeq3) testSeq3.addEventListener('click', () => sendServoCommand(ServoCommands.SEQUENCE, 3));

    const initServo = byId('initServo');
    if (initServo) {
        initServo.addEventListener('click', () => sendServoCommand(ServoCommands.INIT));
    }

    const laserOnBtn = byId('laserOn');
    const laserOffBtn = byId('laserOff');

    if (laserOnBtn) {
        laserOnBtn.addEventListener('click', () => sendLaserCommand(LaserCommands.ON));
    }

    if (laserOffBtn) {
        laserOffBtn.addEventListener('click', () => sendLaserCommand(LaserCommands.OFF));
    }

    // Filesystem browser
    const fsRefreshBtn = byId('fs-refresh');
    const fsPathInput = byId('fs-path');
    const fsList = byId('fs-list');
    const fsContent = byId('fs-content');
    const fsFileName = byId('fs-file-name');
    const fsCopyBtn = byId('fs-copy');
    const fsFileInfo = byId('fs-file-info');

    async function loadFilesystem(path = '/') {
        try {
            updateStatus(`Loading filesystem: ${path}`, 'info');
            const response = await fetch(`${host}/api/filesystem/list?path=${encodeURIComponent(path)}`);

            if (!response.ok) {
                const errorText = await response.text();
                updateStatus(`Server error: ${response.status} ${response.statusText}`, 'error');
                fsList.innerHTML = `<p class="text-sm text-red-400 p-2">Server error: ${response.status}</p>`;
                return;
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const responseText = await response.text();
                console.error('Response content-type:', contentType);
                console.error('Response body:', responseText.substring(0, 500));
                updateStatus(`Invalid response format. Content-Type: ${contentType || 'none'}`, 'error');
                fsList.innerHTML = `<p class="text-sm text-red-400 p-2">Invalid response format. Check console for details.</p>`;
                return;
            }

            const data = await response.json();

            if (!data.success) {
                updateStatus(`Error: ${data.error}`, 'error');
                fsList.innerHTML = `<p class="text-sm text-red-400 p-2">${data.error}</p>`;
                return;
            }

            if (data.items.length === 0) {
                fsList.innerHTML = '<p class="text-sm text-gray-400 p-2">Empty directory</p>';
                return;
            }

            // Sort: directories first, then files alphabetically
            data.items.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });

            fsList.innerHTML = data.items.map(item => {
                const icon = item.isDirectory ? 'fa-folder' : 'fa-file';
                const sizeText = item.isDirectory ? '' : `<span class="text-xs text-gray-500">(${formatBytes(item.size)})</span>`;
                const clickHandler = item.isDirectory ? '' : `onclick="window.loadFileContent('${item.path}')"`;
                return `
                    <div class="flex items-center gap-2 px-2 py-1 hover:bg-white/10 rounded cursor-pointer transition-colors" ${clickHandler}>
                        <i class="fas ${icon} text-primary w-4"></i>
                        <span class="flex-1 text-sm truncate">${item.name}</span>
                        ${sizeText}
                    </div>
                `;
            }).join('');

            updateStatus(`Loaded ${data.items.length} items from ${path}`, 'success');
        } catch (error) {
            updateStatus(`Failed to load filesystem: ${error.message}`, 'error');
            fsList.innerHTML = `<p class="text-sm text-red-400 p-2">Failed to load: ${error.message}</p>`;
        }
    }

    async function loadFileContent(path) {
        try {
            updateStatus(`Reading file: ${path}`, 'info');
            const response = await fetch(`${host}/api/filesystem/read?path=${encodeURIComponent(path)}`);

            if (!response.ok) {
                const errorText = await response.text();
                updateStatus(`Server error: ${response.status} ${response.statusText}`, 'error');
                fsContent.innerHTML = `<code class="text-red-400">Server error: ${response.status}</code>`;
                fsFileName.textContent = 'Error';
                fsCopyBtn.classList.add('hidden');
                fsFileInfo.classList.add('hidden');
                return;
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                updateStatus('Invalid response format (expected JSON)', 'error');
                fsContent.innerHTML = '<code class="text-red-400">Invalid response format</code>';
                fsFileName.textContent = 'Error';
                fsCopyBtn.classList.add('hidden');
                fsFileInfo.classList.add('hidden');
                return;
            }

            const data = await response.json();

            if (!data.success) {
                updateStatus(`Error: ${data.error}`, 'error');
                fsContent.innerHTML = `<code class="text-red-400">${data.error}</code>`;
                fsFileName.textContent = 'Error';
                fsCopyBtn.classList.add('hidden');
                fsFileInfo.classList.add('hidden');
                return;
            }

            fsContent.innerHTML = `<code>${escapeHtml(tryFormatJSON(data.content))}</code>`;
            fsFileName.textContent = path;
            fsCopyBtn.classList.remove('hidden');
            fsFileInfo.classList.remove('hidden');
            fsFileInfo.textContent = `Size: ${formatBytes(data.size)} | Path: ${data.path}`;
            updateStatus(`Loaded file: ${path} (${formatBytes(data.size)})`, 'success');
        } catch (error) {
            updateStatus(`Failed to read file: ${error.message}`, 'error');
            fsContent.innerHTML = `<code class="text-red-400">Failed to load: ${error.message}</code>`;
            fsFileName.textContent = 'Error';
            fsCopyBtn.classList.add('hidden');
            fsFileInfo.classList.add('hidden');
        }
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function tryFormatJSON(content) {
        try {
            const parsed = JSON.parse(content);
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            return content;
        }
    }

    if (fsRefreshBtn) {
        fsRefreshBtn.addEventListener('click', () => {
            const path = fsPathInput?.value || '/';
            loadFilesystem(path);
        });
    }

    if (fsCopyBtn) {
        fsCopyBtn.addEventListener('click', async () => {
            const content = fsContent.textContent;
            try {
                await navigator.clipboard.writeText(content);
                updateStatus('Content copied to clipboard', 'success');
                fsCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    fsCopyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                }, 2000);
            } catch (error) {
                updateStatus('Failed to copy to clipboard', 'error');
            }
        });
    }

    // Make loadFileContent globally accessible
    window.loadFileContent = loadFileContent;

    // Storage stats
    const refreshStorageBtn = byId('refresh-storage');
    const storageTotal = byId('storage-total');
    const storageUsed = byId('storage-used');
    const storageFree = byId('storage-free');
    const storagePercentage = byId('storage-percentage');
    const storageProgress = byId('storage-progress');

    async function loadStorageStats() {
        try {
            updateStatus('Loading storage stats...', 'info');
            const response = await fetch(`${host}/api/filesystem/stats`);

            if (!response.ok) {
                updateStatus(`Failed to load storage stats: ${response.status}`, 'error');
                return;
            }

            const data = await response.json();

            if (!data.success) {
                updateStatus(`Error loading storage: ${data.error}`, 'error');
                return;
            }

            // Update display
            const total = data.total || 0;
            const used = data.used || 0;
            const free = data.free || 0;
            const percentage = total > 0 ? Math.round((used / total) * 100) : 0;

            if (storageTotal) storageTotal.textContent = formatBytes(total);
            if (storageUsed) storageUsed.textContent = formatBytes(used);
            if (storageFree) storageFree.textContent = formatBytes(free);
            if (storagePercentage) storagePercentage.textContent = `${percentage}%`;
            if (storageProgress) storageProgress.style.width = `${percentage}%`;

            updateStatus(`Storage stats updated: ${percentage}% used`, 'success');
        } catch (error) {
            updateStatus(`Failed to load storage stats: ${error.message}`, 'error');
        }
    }

    if (refreshStorageBtn) {
        refreshStorageBtn.addEventListener('click', loadStorageStats);
    }

    // Load storage stats on initialization
    loadStorageStats();
}

export {
    ServoCommands,
    LaserCommands,
    sendServoCommand,
    sendLaserCommand,
    updateCurrentPosition,
    updateLaserStatus,
    updateStatus,
    initDebugPage
};

// Make globally available
window.updateStatus = updateStatus;
