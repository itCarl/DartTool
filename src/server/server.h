#ifndef SERVER_H
#define SERVER_H

#include <functional>
#include <ArduinoJson.h>

using WsCommandHandler = std::function<bool(JsonDocument&)>;

struct CommandEntry {
    const char* cmd;
    WsCommandHandler handler;
};

void initServer();

#endif // SERVER_H
