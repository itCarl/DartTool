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
