#pragma once

#include <Arduino.h>

class ExternalService {
public:
    static ExternalService& instance();

    void setHost(const String& host);
    const String& getHost() const;

    void setApiToken(const String& token);
    bool hasApiToken() const;

    void setPollInterval(unsigned long intervalMs);
    unsigned long getPollInterval() const;

    void setEnabled(bool enabled);
    bool isEnabled() const;

    void resetPollTimer();

    void pollGameState();
    bool fetchPlayers();

private:
    ExternalService() = default;

    String host_;
    String apiToken_;
    unsigned long pollInterval_ = 5000; // ms
    bool enabled_ = false;
    unsigned long lastPollTime_ = 0;
    bool firstPollCompleted_ = false;
    int lastSyncedGameStatus_ = 0;
};
