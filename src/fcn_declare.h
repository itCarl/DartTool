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

// storage.cpp
void initStorage();
void loadConfig();
void saveConfig();

// server.cpp
void initServer();
void notify();
void notfiyPwr();
void handleWebSocketMessage(void *arg, uint8_t *data, size_t len);
void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len);
String processor(const String& var);
void cleanupWs();

#endif
