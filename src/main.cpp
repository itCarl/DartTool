#include <Arduino.h>

/*
 * Arduino IDE compatibility file.
 */

#include "DartTool.h"

void setup()
{
    DartTool::instance().setup();
}

void loop()
{
    DartTool::instance().loop();
}
