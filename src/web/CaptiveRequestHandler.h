#ifndef CaptiveRequestHandler_h
#define CaptiveRequestHandler_h

#include "../DartTool.h"


class CaptiveRequestHandler : public AsyncWebHandler {

    public:
        CaptiveRequestHandler() {}

        bool canHandle(__unused AsyncWebServerRequest *request) const override
        {
            if (request->url().startsWith("/ws")) return false;
            return true;
        }

        void handleRequest(AsyncWebServerRequest *request) override
        {
            request->send(LittleFS, "/captivePortal.html", "text/html");
        }
};

#endif
