// ============================================================================
// DEBUG PAGE - SERVO AND LASER FUNCTIONS
// ============================================================================

import { byId, on } from './utils.js';
import { sendMessage, ws } from './network.js';

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
