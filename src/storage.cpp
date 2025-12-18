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
        Serial.println("Failed to open directory");
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
