#pragma once
#ifndef FCNDeclare_h
#define FCNDeclare_h

#include "DartTool.h"

// display.cpp
void initLCD();
void showMessage(const char* msg);
void clearRow(uint8_t y);
void clearFirstRow();
void clearSecondRow();
void clearRowSegment(uint8_t y, uint8_t start, uint8_t end);
void printSpaceBetween(String left, String right);
void printCentered(String text, uint8_t row);

// storage.cpp
void initStorage();
void loadConfig();
void saveConfig();
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

#endif
