#include "../DartTool.h"
#include "HardwareCommandHandlers.h"

bool handleSetServo(JsonDocument& doc)
{
    int position = doc["pos"].as<int>();

    if (!servoIsValidPosition(position)) {
        doc["msg"] = "Invalid position: must be 0-180";
        doc["cmd"] = "servoResponse";
        return true;
    }

    servoSetPosition(position);

    doc["cmd"] = "servoResponse";
    doc["pos"] = position;
    doc["msg"] = "Servo position set";

    return true;
}

bool handleServoSequence(JsonDocument& doc)
{
    int sequence = doc["seq"].as<int>();

    switch(sequence) {
        case 1:
            servoSequence1();
            break;
        case 2:
            servoSequence2();
            break;
        case 3:
            servoSequence3();
            break;
        default:
            doc["msg"] = "Unknown sequence number";
            doc["cmd"] = "servoResponse";
            return true;
    }

    doc["cmd"] = "servoResponse";
    doc["seq"] = sequence;
    doc["msg"] = "Sequence executed";

    return true;
}

bool handleInitServo(JsonDocument& doc)
{
    servoInitSequence();

    doc["cmd"] = "servoResponse";
    doc["pos"] = 90;
    doc["msg"] = "Servo initialized";

    return true;
}

bool handleSetServoByDistance(JsonDocument& doc)
{
    double distance = doc["dis"].as<double>();
    double height = doc["height"].as<double>();

    // Use default height if not provided (assuming some default mounting height)
    if (height == 0) {
        height = 100.0; // Default height in cm, adjust as needed
    }

    // Calculate angle based on height and distance
    int theta = servoAngleByDistance(height, distance);
    int servoPos = round(theta + 40.5);

    if (!servoIsValidPosition(servoPos)) {
        doc["msg"] = "Calculated angle out of range (0-180)";
        doc["cmd"] = "servoResponse";
        doc["theta"] = theta;
        doc["pos"] = servoPos;
        return true;
    }

    servoSetPosition(servoPos);

    doc["cmd"] = "servoResponse";
    doc["theta"] = theta;
    doc["pos"] = servoPos;
    doc["distance"] = distance;
    doc["height"] = height;
    doc["msg"] = "Servo position set by distance";

    return true;
}

bool handleLaserControl(JsonDocument& doc)
{
    String action = doc["action"].as<String>();

    if (action == "on") {
        laserOn();
        doc["state"] = true;
        doc["msg"] = "Laser ON";
    } else if (action == "off") {
        laserOff();
        doc["state"] = false;
        doc["msg"] = "Laser OFF";
    } else if (action == "toggle") {
        laserToggle();
        doc["state"] = laserGetState();
        doc["msg"] = laserGetState() ? "Laser ON" : "Laser OFF";
    } else {
        doc["msg"] = "Invalid action. Use 'on', 'off', or 'toggle'";
        doc["state"] = laserGetState();
        return true;
    }

    doc["cmd"] = "laserResponse";
    return true;
}
