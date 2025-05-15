#define DEFINE_GLOBAL_VARS
#include "DartTool.h"
#include <Arduino.h>

DartTool::DartTool()
{
    //
}

void DartTool::setup()
{
    // sanity check delay - allows reprogramming if accidently doing stupid things
    // delay(1000);

    Serial.begin(115200);
    Wire.begin();
    Wire.setClock(400000); // use 400 kHz I2C
    randomSeed(rand());   // prepare for random number generation

    initPins();
    initLCD();

    LCD.print(".");
    delay(1000);

    initDistanceSensor();

    LCD.print(".");
    delay(1000);

    initServo();

    LCD.print(".");
    delay(1000);

    initConnection();
    initServer();

    DEBUG_PRINTLN("Web Server started");
    LCD.print("Setup done!");
    delay(5000);
    // LCD.clear();
    // LCD.home();
}

void DartTool::loop()
{
    // cleanupWs();

    // delay(3000);
    // laserServo.write(0);
    // LCD.clear();
    // LCD.home();
    // LCD.print("0");
    // delay(3000);
    // LCD.clear();
    // LCD.home();
    // LCD.print("180");
    // laserServo.write(180);
    if (Serial.available()) {
        delay(100);
        LCD.clear();
        while (Serial.available() > 0) {
            LCD.write(Serial.read());
        }
    }

    // sensor.read();

    // Serial.print("range: ");
    // Serial.print(sensor.ranging_data.range_mm);
    // Serial.print("\tstatus: ");
    // Serial.print(VL53L1X::rangeStatusToString(sensor.ranging_data.range_status));
    // Serial.print("\tpeak signal: ");
    // Serial.print(sensor.ranging_data.peak_signal_count_rate_MCPS);
    // Serial.print("\tambient: ");
    // Serial.print(sensor.ranging_data.ambient_count_rate_MCPS);

    // Serial.println();
}
void DartTool::restart()
{
    ws.closeAll(1012);
    ws.cleanupClients(0);
    WiFi.disconnect();
    DEBUG_PRINTLN("DartTool restart");
    ESP.restart();
}

void DartTool::reset()
{
    DEBUG_PRINTLN("DartTool reset");
    // storage.clear();
    DartTool::instance().restart();
}

void DartTool::initPins()
{
    // pinMode(RELAY, OUTPUT);
    // digitalWrite(RELAY, LOW);

    // Debug LED
    // pinMode(DEBUG_LED, OUTPUT);
    // digitalWrite(LED_BUILTIN, HIGH);
    // delay(500);
    // digitalWrite(DEBUG_LED, LOW);
    // delay(500);
    // digitalWrite(LED_BUILTIN, HIGH);
    // delay(500);
    // digitalWrite(DEBUG_LED, LOW);
}

void DartTool::initDistanceSensor()
{
    sensor.setTimeout(500);
    if (!sensor.init())
    {
        Serial.println("Failed to detect and initialize sensor!");
        // while (1); // causes intentional watchdog timer to trigger
    }

    // timing budget.
    sensor.startContinuous(50);
}

void DartTool::initServo()
{
    // laserServo.attach(2, 1100, 2050, 0);
    laserServo.attach(2);
}

void DartTool::initConnection()
{
    WiFi.disconnect();
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);

    LCD.setCursor(0, 1);
    LCD.print("WiFi");
    LCD.setCursor(4, 1);

    // WiFi.config(IPAddress((uint32_t)0), IPAddress((uint32_t)0), IPAddress((uint32_t)0));
    WiFi.hostname(WIFI_HOSTNAME);
    WiFi.begin(clientSSID, clientPass);
    uint8_t connectionCounter = 0;

    while (WiFi.waitForConnectResult(1000) != WL_CONNECTED) {
        LCD.print(".");
        DEBUG_PRINT("Connection Failed! SSID: ");
        DEBUG_PRINTLN(clientSSID);

        if(connectionCounter >= 5) {
            clearSecondRow();
            LCD.setCursor(0, 1);
            LCD.print("starting AP");
            DEBUG_PRINTLN("Starting a Access Point...");
            WiFi.disconnect(true);
            WiFi.mode(WIFI_AP);
            WiFi.softAP(apSSID);
            // WiFi.softAP("Nothing to see here", "0hB4by4Tr1ppl3");
            WiFi.softAPConfig(IPAddress(4, 3, 2, 1), IPAddress(4, 3, 2, 1), IPAddress(255, 255, 255, 0));
            // dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
            // dnsServer.start(53, "*", WiFi.softAPIP());
            server.addHandler(new CaptiveRequestHandler()).setFilter(ON_AP_FILTER); //only when requested from AP+

            IPAddress IP = WiFi.softAPIP();
            LCD.clear();
            LCD.home();
            LCD.println("IP-Address:");
            LCD.print(IP);
            DEBUG_PRINT("AP IP-Address:");
            DEBUG_PRINTLN(IP);
            break;
            // Serial.println("Connection Failed! Rebooting...");
            // ESP.restart();
        }

        connectionCounter++;
    }

    LCD.setCursor(13, 0);
    LCD.print(".");
    delay(1000);
    clearSecondRow();
    LCD.setCursor(0, 1);
    LCD.print("done");
    delay(2000);
    if(connectionCounter < 5) {
        initAP();
    }
    LCD.clear();
    LCD.home();
}

void DartTool::initAP()
{
    LCD.clear();
    LCD.home();
    LCD.print("IP-Address:");
    LCD.setCursor(0, 1);
    LCD.print(WiFi.localIP());
    DEBUG_PRINTLN("Ready");
    DEBUG_PRINT("IP-Address: ");
    DEBUG_PRINTLN(WiFi.localIP());
    delay(5000);
}
