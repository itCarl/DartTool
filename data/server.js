class ServerAPI {
    constructor(host = null) {
        this.host = host || window.location.origin;
        this.timeout = 10000;
    }
    async restCall(endpoint, data = null, method = 'GET') {
        try {
            const options = { method, headers: { 'Content-Type': 'application/json' } };
            if (data && ['POST', 'PUT', 'PATCH'].includes(method)) options.body = JSON.stringify(data);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            const response = await fetch(`${this.host}${endpoint}`, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`[API] ${error.message}`);
            throw error;
        }
    }
    async sendCommand(command) {
        if (typeof ws !== 'undefined' && ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(command));
            return { success: true, via: 'websocket' };
        }
        console.warn('[API] WebSocket down, using REST');
        return await this.restCall('/api/command', command, 'POST');
    }
    getWiFiStatus() { return this.restCall('/api/wifi/status'); }
    getSettings() { return this.restCall('/api/settings'); }
    saveSettings(s) { return this.restCall('/api/settings', s, 'POST'); }
    reboot() { return this.sendCommand({ cmd: 'reboot' }); }
    getFreeHeap() { return this.restCall('/api/system/heap'); }
    getUptime() { return this.restCall('/api/system/uptime'); }
    ping() { return this.restCall('/api/system/ping'); }
    getGameStatus() { return this.restCall('/api/data/game-status'); }
    updateGameStatus(d) { return this.restCall('/api/data/game-status', d, 'POST'); }
    getScores() { return this.restCall('/api/data/scores'); }
    getOperationMode() { return this.restCall('/api/mode'); }
    setOperationMode(m) { return this.sendCommand({ cmd: 'setMode', mode: m }); }
    getExternalHostConfig() { return this.restCall('/api/external/config'); }
    setExternalHostConfig(h) { return this.restCall('/api/external/config', { host: h }, 'POST'); }
    async setServo(pos) {
        if (typeof pos !== 'number' || pos < 0 || pos > 180) throw new Error('Invalid servo pos 0-180');
        return await this.sendCommand({ cmd: 'setServo', pos });
    }
    async servoSequence(seq) {
        if (typeof seq !== 'number' || seq < 1 || seq > 3) throw new Error('Invalid seq 1-3');
        return await this.sendCommand({ cmd: 'servoSequence', seq });
    }
    initServo() { return this.sendCommand({ cmd: 'initServo' }); }
    getServoStatus() { return this.restCall('/api/servo/status'); }
}
const server = new ServerAPI();
