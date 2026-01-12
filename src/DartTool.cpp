#define DEFINE_GLOBAL_VARS
#include "DartTool.h"

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

    // initAdvance("File system");
    initStorage();

    // initAdvance("GPIOs");
    initPins();

    initAdvance("Display");
    initLCD();

    // initDistanceSensor();
    // initAdvance("TOF Sensor");

    initAdvance("Servo");
    servoInit();

    initAdvance("Laser");
    laserInit();

    initAdvance("Network");
    initConnection();

    initAdvance("Server");
    initServer();

    // initAdvance("Players");
    PlayerManager::instance().init();
    // PlayerManager::instance().addOrEditPlayer("Max1");
    // PlayerManager::instance().addOrEditPlayer("Spieler3");
    // PlayerManager::instance().addOrEditPlayer("Player sjfho erhbfwif sdfsf");

    // initAdvance("ExternalService");
    ExternalService::instance().setHost(externalServiceHost);
    ExternalService::instance().setApiToken(externalServiceToken);
    ExternalService::instance().setEnabled(EXTERNAL_SERVICE_ENABLED);

    listDir(LittleFS, "/", 1);

    initAdvance("Done");
    // Set game to initialised state after ESP32 boot is complete
    game.setStatus(DartGameStatus::initialised);
    DEBUG_PRINTLN("[DT] ESP32 boot complete - Game initialised");
}

void DartTool::loop()
{
    delay(500);
    yield();
    if(apActive) dnsServer.processNextRequest();
    ElegantOTA.loop();
    cleanupWs();

    // Update LCD with current game state
    static DartGameStatus lastDisplayedStatus = DartGameStatus::unknown;
    static uint8_t lastDisplayedThrow = 0;
    static uint8_t lastDisplayedPlayer = 0;
    static String lastDisplayedMode = "";
    static uint16_t lastDisplayedPoints = 0;

    String currentMode = game.getGameModeName();
    uint16_t currentPoints = game.getGamePoints();

    // Update display when game state, player, or throw count changes
    if (game.getStatus() != lastDisplayedStatus ||
        game.getThrowCounter() != lastDisplayedThrow ||
        game.getCurrentPlayerIndex() != lastDisplayedPlayer ||
        currentMode != lastDisplayedMode ||
        currentPoints != lastDisplayedPoints) {

        displayGameState(game);
        lastDisplayedStatus = game.getStatus();
        lastDisplayedThrow = game.getThrowCounter();
        lastDisplayedPlayer = game.getCurrentPlayerIndex();
        lastDisplayedMode = currentMode;
        lastDisplayedPoints = currentPoints;
    }

    // Poll external service for game state updates
    // pollExternalGameState();

    // printConnectedClients();


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
    // if (Serial.available()) {
    //     delay(100);
    //     LCD.clear();
    //     while (Serial.available() > 0) {
    //         LCD.write(Serial.read());
    //     }
    // }

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
    // ws.cleanupClients(0);
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


void DartTool::initConnection()
{
    WiFi.disconnect(true);
    delay(50);
    WiFi.softAPdisconnect();
    delay(50);

    WiFi.mode(WIFI_STA);
    WiFi.begin(CLIENT_SSID, CLIENT_PASS);

    uint8_t retries = 0;
    while (WiFi.waitForConnectResult(1000) != WL_CONNECTED && retries < 3) {
        retries++;
    }

    if(WIFI_CONNECTED) {
        // LCD.print("Connected to WLAN");
        // printCentered(CLIENT_SSID, 1);
        // LCD.setCursor(0, 2);
        // LCD.print("IP-Address:");
        delay(500);
        initAdvanceDetails("IP-Address:", WiFi.localIP().toString());
        // printCentered(WiFi.localIP().toString(), 3);
        DEBUG_PRINTLN("WLAN connected");
        DEBUG_PRINT("IP: ");
        DEBUG_PRINTLN(WiFi.localIP());
    } else {
        initAP();

        initAdvanceDetails("Connect to: ", apSSID);
        // LCD.print("Connect to: ");
        // LCD.setCursor(0, 1);
        // LCD.print(apSSID); //WIFI_HOSTNAME
    }
}

void DartTool::initAP()
{
    WiFi.mode(WIFI_AP);

    WiFi.softAPConfig(apIP, apIP, subnet);
    WiFi.softAP(apSSID);
    apActive = true;

    dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
    dnsServer.start(53, "*", apIP);
    DEBUG_PRINTLN("AP opened");
}
