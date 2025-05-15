#pragma once
#ifndef DartTool_h
#define DartTool_h
#define ELEGANTOTA_USE_ASYNC_WEBSERVER 1

#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include <ESPAsyncWebServer.h>
// #include <DNSServer.h>
#include <ElegantOTA.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <LiquidCrystal_I2C.h>
#include <VL53L1X.h>
#include <Servo.h>

// Custom Libs
#include "const.h"
#include "fcn_declare.h"
#include "config.h"

// web classes
#include "web/CaptiveRequestHandler.h"

#ifndef VERSION_CODE
    #define VERSION_CODE "unkown"
#endif

#ifndef VERSION
    #define VERSION "err"
#endif

#ifndef BUILD_TIME
    #define BUILD_TIME "unkown"
#endif

#ifndef CLIENT_SSID
    #define CLIENT_SSID "none"
#endif

#ifndef CLIENT_PASS
#define CLIENT_PASS ""
#endif

// GLOBAL VARIABLES
// both declared and defined in header (solution from http://www.keil.com/support/docs/1868.htm)
//
//e.g. byte test = 2 becomes DT_GLOBAL byte test _INIT(2);
//     int arr[]{0,1,2} becomes DT_GLOBAL int arr[] _INIT_N(({0,1,2}));
#ifndef DEFINE_GLOBAL_VARS
    #define DT_GLOBAL extern
    #define _INIT(x)
    #define _INIT_N(x)
#else
    #define DT_GLOBAL
    #define _INIT(x) = x
    #define UNPACK( ... ) __VA_ARGS__
    #define _INIT_N(x) UNPACK x
#endif

DT_GLOBAL char clientSSID[33] _INIT(CLIENT_SSID);
DT_GLOBAL char clientPass[65] _INIT(CLIENT_PASS);

DT_GLOBAL char apSSID[33] _INIT("DartTool");
// DT_GLOBAL char apPass[65]  _INIT(DEFAULT_AP_PASS);

DT_GLOBAL AsyncWebServer server _INIT_N(((80)));
DT_GLOBAL AsyncWebSocket ws _INIT_N((("/ws")));
DT_GLOBAL String escapedMac _INIT("x");
DT_GLOBAL char cmDNS[33] _INIT(MDNS_NAME);
DT_GLOBAL bool ap_active _INIT(false);

// DT_GLOBAL Preferences storage;

DT_GLOBAL LiquidCrystal_I2C LCD _INIT_N(((0x27, 20, 4)));

DT_GLOBAL VL53L1X sensor;

DT_GLOBAL Servo laserServo;

DT_GLOBAL unsigned long wsLastLiveTime _INIT(0);

DT_GLOBAL uint8_t arrowUp[8] _INIT_N(({
    0x04, 0x0E, 0x15, 0x04, 0x04, 0x04, 0x04, 0x04
}));

DT_GLOBAL uint8_t arrowDown[8] _INIT_N(({
    0x04, 0x04, 0x04, 0x04, 0x04, 0x15, 0x0E, 0x04
}));

#ifdef PRINT_DEBUG
    #define DEBUG_PRINT(x) Serial.printf("%s %s", "[DartTool] ", x)
    #define DEBUG_PRINTLN(x) Serial.printf("%s %s\n", "[DartTool] ", x) //Serial.println(x)
    #define DEBUG_PRINTF(x...) Serial.printf(x)
#else
    #define DEBUG_PRINT(x)
    #define DEBUG_PRINTLN(x)
    #define DEBUG_PRINTF(x...)
#endif

#ifdef PRINT_PLOT
    #define PLOT_PRINTLN(x) Serial.println(x)
    #define PLOT_PRINTF(x...) Serial.printf(x)
#else
    #define PLOT_PRINTLN(x)
    #define PLOT_PRINTF(x...)
#endif

class DartTool
{
    public:
     DartTool();
        static DartTool& instance()
        {
            static DartTool instance;
            return instance;
        }

        void setup();
        void loop();
        void reset();
        void restart();

        void initPins();
        void initDistanceSensor();
        void initServo();
        void initConnection();
        void initAP();
};

#endif
