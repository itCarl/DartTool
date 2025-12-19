#include "DartTool.h"

static int servoCurrentPos = SERVO_HOME_POS;
static bool servoInitialized = false;

void servoInit() {
    if (servoInitialized) return;

    laserServo.attach(SERVO_PIN);
    servoCurrentPos = SERVO_HOME_POS;
    laserServo.write(servoCurrentPos);
    servoInitialized = true;

    DEBUG_PRINTLN("[Servo] Initialized");
}

void servoSetPosition(int position) {
    if (!servoInitialized) {
        DEBUG_PRINTLN("[Servo] Not initialized");
        return;
    }

    if (position < SERVO_MIN_POS || position > SERVO_MAX_POS) {
        DEBUG_PRINTF("[Servo] Invalid position: %d (must be 0-180)\n", position);
        return;
    }

    servoCurrentPos = position;
    laserServo.write(position);
    DEBUG_PRINTF("[Servo] Position set to: %d°\n", position);
}

void servoMoveToPosition(int position, uint16_t delayMs) {
    servoSetPosition(position);
    if (delayMs > 0) {
        delay(delayMs);
    }
}

int servoGetPosition() {
    return servoCurrentPos;
}

bool servoIsValidPosition(int position) {
    return position >= SERVO_MIN_POS && position <= SERVO_MAX_POS;
}

int servoAngleByDistance(double height, double distance) {
    int baseAngle = calculateAngleByHeightAndTargetDistance(height, distance);
    return baseAngle;
}

void servoSequence1() {
    if (!servoInitialized) return;

    DEBUG_PRINTLN("[Servo] Sequence 1: 0° → 180° → 0°");
    servoMoveToPosition(0, 500);
    servoMoveToPosition(180, 500);
    servoMoveToPosition(0, 500);
    servoMoveToPosition(SERVO_HOME_POS, 0);
}

void servoSequence2() {
    if (!servoInitialized) return;

    DEBUG_PRINTLN("[Servo] Sequence 2: Slow movement 0° → 180°");
    for (int pos = SERVO_MIN_POS; pos <= SERVO_MAX_POS; pos += 5) {
        servoSetPosition(pos);
        delay(30);
    }
    servoMoveToPosition(SERVO_HOME_POS, 0);
}

void servoSequence3() {
    if (!servoInitialized) return;

    DEBUG_PRINTLN("[Servo] Sequence 3: Fast oscillation 45° ↔ 135°");
    for (int i = 0; i < 10; i++) {
        servoSetPosition(45);
        delay(100);
        servoSetPosition(135);
        delay(100);
    }
    servoMoveToPosition(SERVO_HOME_POS, 0);
}

void servoInitSequence() {
    if (!servoInitialized) return;

    DEBUG_PRINTLN("[Servo] Init sequence");
    servoMoveToPosition(0, 2000);
    servoMoveToPosition(90, 2000);
    servoMoveToPosition(180, 3000);
    servoMoveToPosition(90, 1000);
}

void servoShutdown() {
    if (servoInitialized) {
        laserServo.detach();
        servoInitialized = false;
        DEBUG_PRINTLN("[Servo] Shutdown");
    }
}
