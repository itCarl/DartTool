#include "DartTool.h"

void initStorage()
{
    if(!LittleFS.begin()){
        DEBUG_PRINTLN("LittleFS Mount Failed");
        return;
    } else{
        DEBUG_PRINTLN("Little FS Mounted Successfully");
    }

    loadConfig();
}

void loadConfig()
{
    storage.begin("cfg", false);

    // Kp = storage.getDouble("Kp", Kp);
    // Ki = storage.getDouble("Ki", Ki);
    // Kd = storage.getDouble("Kd", Kd);

    // Load WiFi settings from NVS
    size_t ssidLen = storage.getBytes("ssid", (uint8_t*)NULL, 0);
    if (ssidLen > 0 && ssidLen < 33) {
        storage.getBytes("ssid", (uint8_t*)clientSSID, ssidLen);
        clientSSID[ssidLen] = '\0';
    }

    size_t passLen = storage.getBytes("pass", (uint8_t*)NULL, 0);
    if (passLen > 0 && passLen < 65) {
        storage.getBytes("pass", (uint8_t*)clientPass, passLen);
        clientPass[passLen] = '\0';
    }

    size_t hostnameLen = storage.getBytes("hostname", (uint8_t*)NULL, 0);
    if (hostnameLen > 0 && hostnameLen < 33) {
        char tempHostname[33];
        storage.getBytes("hostname", (uint8_t*)tempHostname, hostnameLen);
        tempHostname[hostnameLen] = '\0';
        strncpy(apSSID, tempHostname, 32);
        apSSID[32] = '\0';
    }

    // Load External Service settings
    size_t extHostLen = storage.getBytes("ext_host", (uint8_t*)NULL, 0);
    if (extHostLen > 0 && extHostLen < 129) {
        char temp[129];
        storage.getBytes("ext_host", (uint8_t*)temp, extHostLen);
        temp[extHostLen] = '\0';
        ExternalService::instance().setHost(String(temp));
    }

    size_t extTokenLen = storage.getBytes("ext_token", (uint8_t*)NULL, 0);
    if (extTokenLen > 0 && extTokenLen < 257) {
        char tkn[257];
        storage.getBytes("ext_token", (uint8_t*)tkn, extTokenLen);
        tkn[extTokenLen] = '\0';
        ExternalService::instance().setApiToken(String(tkn));
    }

    bool extEnabled = storage.getBool("ext_enabled", false);
    ExternalService::instance().setEnabled(extEnabled);

    unsigned long extInterval = storage.getULong("ext_interval", 5000);
    ExternalService::instance().setPollInterval(extInterval);

    size_t modeLen = storage.getBytes("mode", (uint8_t*)NULL, 0);
    if (modeLen > 0 && modeLen < 33) {
        char mode[33] = {0};
        char gameEndpoint[257] = {0};
        int refreshInterval = 5;

        storage.getBytes("mode", (uint8_t*)mode, modeLen);
        mode[modeLen] = '\0';

        size_t endpointLen = storage.getBytes("gameEndpoint", (uint8_t*)NULL, 0);
        if (endpointLen > 0 && endpointLen < 257) {
            storage.getBytes("gameEndpoint", (uint8_t*)gameEndpoint, endpointLen);
            gameEndpoint[endpointLen] = '\0';
        }

        refreshInterval = storage.getInt("refreshInterval", 5);

        DEBUG_PRINT("[Storage] Mode config loaded: mode=");
        DEBUG_PRINT(mode);
        DEBUG_PRINT(" endpoint=");
        DEBUG_PRINT(gameEndpoint);
        DEBUG_PRINT(" interval=");
        DEBUG_PRINTLN(refreshInterval);
    }

    storage.end();
}

void saveConfig()
{
    storage.begin("cfg", false);

    // storage.putDouble("Kp", Kp);
    // storage.putDouble("Ki", Ki);
    // storage.putDouble("Kd", Kd);

    storage.end();
}

void saveWifiSettings(const char* ssid, const char* password, const char* hostname)
{
    storage.begin("cfg", false);

    if (ssid && strlen(ssid) > 0 && strlen(ssid) < 33) {
        storage.putBytes("ssid", (const uint8_t*)ssid, strlen(ssid));
    }

    if (password && strlen(password) < 65) {
        storage.putBytes("pass", (const uint8_t*)password, strlen(password));
    }

    if (hostname && strlen(hostname) > 0 && strlen(hostname) < 33) {
        storage.putBytes("hostname", (const uint8_t*)hostname, strlen(hostname));
    }

    storage.end();
    DEBUG_PRINTLN("[Storage] WiFi settings saved");
}

void saveExternalServiceConfig(const char* host, const char* token, bool enabled, unsigned long interval)
{
    storage.begin("cfg", false);

    if (host && strlen(host) > 0 && strlen(host) < 129) {
        storage.putBytes("ext_host", (const uint8_t*)host, strlen(host));
    }

    // token may be empty to clear
    if (token) {
        if (strlen(token) > 0 && strlen(token) < 257) {
            storage.putBytes("ext_token", (const uint8_t*)token, strlen(token));
        } else if (strlen(token) == 0) {
            // Clear token by writing zero length
            storage.remove("ext_token");
        }
    }

    storage.putBool("ext_enabled", enabled);
    storage.putULong("ext_interval", interval);

    storage.end();
    DEBUG_PRINTLN("[Storage] External service config saved");
}

void saveModeConfig(const char* mode, const char* gameEndpoint, int refreshInterval)
{
    storage.begin("cfg", false);

    if (mode && strlen(mode) > 0 && strlen(mode) < 33) {
        storage.putBytes("mode", (const uint8_t*)mode, strlen(mode));
    }

    if (gameEndpoint && strlen(gameEndpoint) > 0 && strlen(gameEndpoint) < 257) {
        storage.putBytes("gameEndpoint", (const uint8_t*)gameEndpoint, strlen(gameEndpoint));
    }

    storage.putInt("refreshInterval", refreshInterval);

    storage.end();
    DEBUG_PRINTLN("[Storage] Mode config saved");
}

void loadModeConfig(char* outMode, char* outGameEndpoint, int& outRefreshInterval)
{
    storage.begin("cfg", false);

    size_t modeLen = storage.getBytes("mode", (uint8_t*)NULL, 0);
    if (modeLen > 0 && modeLen < 33) {
        storage.getBytes("mode", (uint8_t*)outMode, modeLen);
        outMode[modeLen] = '\0';
    } else {
        strcpy(outMode, "display");  // default
    }

    size_t endpointLen = storage.getBytes("gameEndpoint", (uint8_t*)NULL, 0);
    if (endpointLen > 0 && endpointLen < 257) {
        storage.getBytes("gameEndpoint", (uint8_t*)outGameEndpoint, endpointLen);
        outGameEndpoint[endpointLen] = '\0';
    } else {
        strcpy(outGameEndpoint, "");  // default empty
    }

    outRefreshInterval = storage.getInt("refreshInterval", 5);  // default 5 seconds

    storage.end();
}

void getWifiSettings(char* outSsid, char* outPassword, char* outHostname)
{
    strncpy(outSsid, clientSSID, 32);
    outSsid[32] = '\0';
    strncpy(outPassword, clientPass, 64);
    outPassword[64] = '\0';
    strncpy(outHostname, apSSID, 32);
    outHostname[32] = '\0';
}

void listDir(fs::FS &fs, const char * dirname, uint8_t levels)
{
    Serial.printf("Listing directory: %s\n", dirname);

    File root = fs.open(dirname);
    if (!root) {
        // Serial.println("Failed to open directory");
        return;
    }
    if (!root.isDirectory()) {
        Serial.println("Not a directory");
        return;
    }

    File file = root.openNextFile();
    while (file) {
        if (file.isDirectory()) {
            Serial.print("DIR : ");
            Serial.println(file.name());
            if (levels) {
                listDir(fs, file.name(), levels - 1);
            }
        } else {
            Serial.print("FILE: ");
            Serial.print(file.name());
            Serial.print("  SIZE: ");
            Serial.println(file.size());
        }
        file = root.openNextFile();
    }
}
