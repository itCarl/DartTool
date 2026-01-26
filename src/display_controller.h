#pragma once

#include <Arduino.h>

class LiquidCrystal_I2C;

// Represents the intended LCD content (20x4 rows).
struct DisplayState {
    String rows[4];

    void clear()
    {
        for (auto &row : rows) {
            row = "";
        }
    }
};

// Visual-only transition hint for the controller.
enum class DisplayTransitionType : uint8_t {
    Immediate = 0,
    DelayOnly
};

struct DisplayTransitionOptions {
    DisplayTransitionType type = DisplayTransitionType::Immediate;
    uint16_t delayMs = 0;
};

class Display {
public:
    explicit Display(LiquidCrystal_I2C &lcdRef);

    // Queue a new visual state. Rendering happens asynchronously via update().
    void setState(const DisplayState &state, DisplayTransitionOptions opts = {});

    // Drive pending transitions/animations. Call this from the main loop.
    void update();

    // Clear the LCD and buffers immediately.
    void forceClear();

private:
    LiquidCrystal_I2C &lcd;
    DisplayState front;
    DisplayState back;
    bool hasPending = false;
    unsigned long transitionStart = 0;
    uint16_t transitionDelay = 0;
    DisplayTransitionType transitionType = DisplayTransitionType::Immediate;
    unsigned long lastRender = 0;
    static constexpr uint16_t kMinFrameIntervalMs = 16; // ~60 fps cap

    static String normalizeRow(const String &raw);
    void renderDiff(const DisplayState &target);
};

extern Display display;
