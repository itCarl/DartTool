#include "DartTool.h"

static bool laserState = false;
static bool laserInitialized = false;

void laserInit() {
    if (laserInitialized) return;

    pinMode(LASER_PIN, OUTPUT);
    digitalWrite(LASER_PIN, LOW);
    laserState = false;
    laserInitialized = true;

    // laserOn();
    // delay(3000);
    laserOff();
    // delay(1000);
    // laserOn();

    DEBUG_PRINTLN("[Laser] Initialized");
}

void laserOn() {
    if (!laserInitialized) {
        DEBUG_PRINTLN("[Laser] Not initialized");
        return;
    }

    digitalWrite(LASER_PIN, HIGH);
    laserState = true;
    DEBUG_PRINTLN("[Laser] ON");
}

void laserOff() {
    if (!laserInitialized) {
        DEBUG_PRINTLN("[Laser] Not initialized");
        return;
    }

    digitalWrite(LASER_PIN, LOW);
    laserState = false;
    DEBUG_PRINTLN("[Laser] OFF");
}

void laserToggle() {
    if (!laserInitialized) {
        DEBUG_PRINTLN("[Laser] Not initialized");
        return;
    }

    if (laserState) {
        laserOff();
    } else {
        laserOn();
    }
}

bool laserGetState() {
    return laserState;
}
