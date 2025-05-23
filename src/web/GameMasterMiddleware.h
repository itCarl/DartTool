#ifndef GameMasterMiddleware_h
#define GameMasterMiddleware_h

#include "DartTool.h"

class GameMasterMiddleware : public AsyncMiddleware
{
    public:
        void run(AsyncWebServerRequest *request, ArMiddlewareNext next) override
        {
            Serial.printf("Before handler: %s %s\n", request->methodToString(), request->url().c_str());
            next();  // continue middleware chain
            Serial.printf("After handler: response code=%d\n", request->getResponse()->code());
        }
};

#endif
