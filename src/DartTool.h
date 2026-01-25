#pragma once
#ifndef DartTool_h
#define DartTool_h
#define ELEGANTOTA_USE_ASYNC_WEBSERVER 1

#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <AsyncTCP.h>
#include <ElegantOTA.h>
#include <DNSServer.h>
#include <ArduinoJson.h>
#include <ESPAsyncWebServer.h>
#include <Wire.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <LiquidCrystal_I2C.h>
#include <VL53L1X.h>
#include <ESP32Servo.h>

// Custom Libs
#include "const.h"
#include "fcn_declare.h"
#include "config.h"
#include "dart/Player.h"
#include "dart/PlayerManager.h"
#include "dart/DartGame.h"
#include "external/ExternalService.h"

#ifndef VERSION_CODE
    #define VERSION_CODE "unknown"
#endif

#ifndef VERSION
    #define VERSION "err"
#endif

#ifndef BUILD_TIME
    #define BUILD_TIME "unknown"
#endif

#ifndef CLIENT_SSID
    #define CLIENT_SSID "none"
#endif

#ifndef CLIENT_PASS
    #define CLIENT_PASS ""
#endif

// Display Animation Configuration (milliseconds) - can be overridden in config.h
#ifndef ANIMATION_DELAY_DEFAULT
    #define ANIMATION_DELAY_DEFAULT 100
#endif

#ifndef ANIMATION_DELAY_CHAR_WRITE
    #define ANIMATION_DELAY_CHAR_WRITE 75
#endif

#ifndef ANIMATION_DELAY_INIT
    #define ANIMATION_DELAY_INIT 150
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
DT_GLOBAL char apPass[65] _INIT("");
DT_GLOBAL uint8_t apChannel _INIT(1);
DT_GLOBAL bool apHidden _INIT(false);
DT_GLOBAL char apOpens[33] _INIT("noConnectionAfterBoot");

DT_GLOBAL AsyncWebServer server _INIT_N(((80)));
DT_GLOBAL AsyncWebSocket ws _INIT_N((("/ws")));
DT_GLOBAL DNSServer dnsServer;

DT_GLOBAL Preferences storage;
DT_GLOBAL DartGame game;

DT_GLOBAL bool apActive _INIT(false);
DT_GLOBAL IPAddress apIP _INIT_N(((4, 3, 2, 1)));
DT_GLOBAL IPAddress subnet _INIT_N(((255, 255, 255, 0)));

DT_GLOBAL LiquidCrystal_I2C LCD _INIT_N(((0x27, 20, 4)));
DT_GLOBAL VL53L1X sensor;
DT_GLOBAL Servo laserServo;

DT_GLOBAL unsigned long wsLastLiveTime _INIT(0);

DT_GLOBAL String gmMAC _INIT("");

// External game state polling
#ifdef EXTERNAL_SERVICE_HOST
    DT_GLOBAL String externalServiceHost _INIT(EXTERNAL_SERVICE_HOST);
#else
    DT_GLOBAL String externalServiceHost _INIT("http://localhost:8000");
#endif
#ifdef EXTERNAL_SERVICE_TOKEN
    DT_GLOBAL String externalServiceToken _INIT(EXTERNAL_SERVICE_TOKEN);
#else
    DT_GLOBAL String externalServiceToken _INIT("");
#endif

#ifdef EXTERNAL_SERVICE_INTERVAL
    DT_GLOBAL unsigned long pollInterval _INIT(EXTERNAL_SERVICE_INTERVAL);
#else
    DT_GLOBAL unsigned long pollInterval _INIT(5000);
#endif

#ifdef EXTERNAL_SERVICE_ENABLED
    DT_GLOBAL bool externalPollingEnabled _INIT(EXTERNAL_SERVICE_ENABLED);
#else
    DT_GLOBAL bool externalPollingEnabled _INIT(false);
#endif

DT_GLOBAL unsigned long lastPollTime _INIT(0);

// Track initial poll for full game state sync
DT_GLOBAL bool firstPollCompleted _INIT(false);
DT_GLOBAL DartGameStatus lastSyncedGameStatus _INIT(DartGameStatus::unknown);

DT_GLOBAL uint8_t arrowUp[8] _INIT_N(({
    0x04, 0x0E, 0x15, 0x04, 0x04, 0x04, 0x04, 0x04
}));

DT_GLOBAL uint8_t arrowDown[8] _INIT_N(({
    0x04, 0x04, 0x04, 0x04, 0x04, 0x15, 0x0E, 0x04
}));

DT_GLOBAL uint8_t dart[8] _INIT_N(({
    0x04, 0x0E, 0x1F, 0x04, 0x0E, 0x1F, 0x0A, 0x11
}));

// #define WIFI_CONNECTED (WiFi.status() == WL_CONNECTED)
#define WIFI_CONNECTED (true)

#ifdef PRINT_DEBUG
    #define DEBUG_PRINT(x) Serial.print(x)
    #define DEBUG_PRINTLN(x) Serial.println(x)
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
