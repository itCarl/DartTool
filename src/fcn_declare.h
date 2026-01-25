#pragma once
#ifndef FCNDeclare_h
#define FCNDeclare_h

#include "DartTool.h"

class DartGame;
class Player;

// display.cpp
void initLCD();
void initAdvance(String text);
void initAdvanceDetails(String textFirstRow, String textSecondRow);
void showMessage(const char* msg);
void clearRow(uint8_t y);
void clearRowSegment(uint8_t y, uint8_t start, uint8_t end);
void clearRowWithAnimation(uint8_t y, uint16_t delayMs = 100);
void clearRowWithAnimationBothSides(uint8_t y, uint16_t delayMs);
void clearRowWithAnimationBothSides(uint8_t y);
void clearRowWithScramble(uint8_t y, uint8_t scrambleCount, uint16_t delayMs = 100);
void printCenteredAnimated(uint8_t y, String text, uint16_t writeDelayMs = 100);
void printSpaceBetween(String left, String right, uint8_t row);
void printCentered(String text, uint8_t row);
String truncateWithEllipsis(String text, uint8_t maxLength);
void drawBigNumber(uint16_t number, uint8_t col, uint8_t row);
void displayGameState(DartGame& game);
void displaySelectedPlayers(const std::vector<Player>& players);
void displaySelectedPlayers(DartGame& game);

// storage.cpp
void initStorage();
void loadConfig();
void saveConfig();
void saveWifiSettings(const char* ssid, const char* password, const char* hostname);
void getWifiSettings(char* outSsid, char* outPassword, char* outHostname);
void saveAPSettings(const char* ssid, const char* password, uint8_t channel, const char* opens, bool hidden);
void getAPSettings(char* outSsid, char* outPassword, uint8_t* outChannel, char* outOpens, bool* outHidden);
void saveExternalServiceConfig(const char* host, const char* token, bool enabled, unsigned long interval);
void saveModeConfig(const char* mode, const char* gameEndpoint, int refreshInterval);
void loadModeConfig(char* outMode, char* outGameEndpoint, int& outRefreshInterval);
void listDir(fs::FS &fs, const char * dirname, uint8_t levels);

// server.cpp
void initServer();
void notify();
void notfiyPwr();
void handleWebSocketMessage(void *arg, uint8_t *data, size_t len);
void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len);
String processor(const String& var);
bool handleFileRead(AsyncWebServerRequest* request, String path);
bool captivePortal(AsyncWebServerRequest *request);
void cleanupWs();

// network
void printConnectedClients();

// servo
void servoInit();
void servoSetPosition(int position);
void servoMoveToPosition(int position, uint16_t delayMs);
int servoGetPosition();
bool servoIsValidPosition(int position);
void servoSequence1();
void servoSequence2();
void servoSequence3();
void servoInitSequence();
void servoShutdown();
int servoAngleByDistance(double height, double distance);

// laser
void laserInit();
void laserOn();
void laserOff();
void laserToggle();
bool laserGetState();

#endif
