#include "display_controller.h"
#include "DartTool.h"

namespace {
const uint8_t kLcdCols = 20;
const uint8_t kLcdRows = 4;
}

Display::Display(LiquidCrystal_I2C &lcdRef)
    : lcd(lcdRef)
{
    front.clear();
    back.clear();
}

String Display::normalizeRow(const String &raw)
{
    if (raw.length() >= kLcdCols) {
        return raw.substring(0, kLcdCols);
    }

    String padded = raw;
    padded.reserve(kLcdCols);
    while (padded.length() < kLcdCols) {
        padded += ' ';
    }
    return padded;
}

void Display::renderDiff(const DisplayState &target)
{
    for (uint8_t row = 0; row < kLcdRows; row++) {
        String desired = normalizeRow(target.rows[row]);
        String current = normalizeRow(front.rows[row]);
        if (desired == current) {
            continue; // No redraw needed
        }

        lcd.setCursor(0, row);
        lcd.print(desired);
        front.rows[row] = desired;
    }
}

void Display::setState(const DisplayState &state, DisplayTransitionOptions opts)
{
    back = state;
    for (uint8_t i = 0; i < kLcdRows; i++) {
        back.rows[i] = normalizeRow(back.rows[i]);
    }

    // Skip scheduling if nothing changes.
    bool identical = true;
    for (uint8_t i = 0; i < kLcdRows; i++) {
        if (back.rows[i] != normalizeRow(front.rows[i])) {
            identical = false;
            break;
        }
    }

    if (identical) {
        hasPending = false;
        return;
    }

    transitionType = opts.type;
    transitionDelay = opts.delayMs;
    transitionStart = millis();
    hasPending = true;

    if (transitionType == DisplayTransitionType::Immediate && transitionDelay == 0) {
        renderDiff(back);
        hasPending = false;
    }
}

void Display::update()
{
    if (!hasPending) return;

    unsigned long now = millis();
    if (transitionType == DisplayTransitionType::DelayOnly && now - transitionStart < transitionDelay) {
        return; // waiting for display-only delay
    }

    if (now - lastRender < kMinFrameIntervalMs) {
        return; // frame rate cap (~60 fps)
    }

    renderDiff(back);
    lastRender = now;
    hasPending = false;
}

void Display::forceClear()
{
    lcd.clear();
    front.clear();
    back.clear();
    hasPending = false;
}

Display display(LCD);
