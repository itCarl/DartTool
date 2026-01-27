#pragma once

#include <ArduinoJson.h>

// Hardware control command handlers
bool handleSetServo(JsonDocument& doc);
bool handleServoSequence(JsonDocument& doc);
bool handleInitServo(JsonDocument& doc);
bool handleSetServoByDistance(JsonDocument& doc);
bool handleLaserControl(JsonDocument& doc);
