#include "DartTool.h"

void initLCD()
{
    LCD.init();
    LCD.backlight();

    // load custom characters
    LCD.createChar(0, arrowUp);
    LCD.createChar(1, arrowDown);

    LCD.home();
    LCD.print("Initializing");
}


void showMessage(const char* msg)
{
    clearFirstRow();
    LCD.print(msg);
    delay(1000);
}

/*
 *
 * Utillitiy functions
 *
 */
void clearRow(uint8_t y)
{
    const char emptyLine[21] = "                    "; // 20 spaces + null terminator
    LCD.setCursor(0, y);
    LCD.print(emptyLine);
    LCD.setCursor(0, y);
}

void clearFirstRow()
{
    clearRow(0);
}

void clearSecondRow()
{
    clearRow(1);
}

void clearRowSegment(uint8_t y, uint8_t start, uint8_t end) {
    if (start > end || end >= 20) return; // Invalid range

    LCD.setCursor(start, y);
    for (uint8_t i = start; i <= end; i++) {
        LCD.print(" ");
    }
    LCD.setCursor(start, y);
}

void printSpaceBetween(String left, String right)
{
    static String leftOld = "";
    static String rightOld = "";

    if (leftOld == left && rightOld == right) return; // No update needed
    // if (leftOld != left && rightOld != right) clearFirstRow();

    uint8_t leftLength = left.length();
    uint8_t rightLength = right.length();
    uint8_t spaceBetween = 16 - (leftLength + rightLength);
    uint8_t offset = leftLength + spaceBetween;

    if (spaceBetween < 0) {
        LCD.home();
        LCD.print("Text too long");
        return;
    }

    if(leftOld != left) {
        LCD.home();
        LCD.print(left);
        clearRowSegment(0, leftLength, offset - 1); // Clear space between
        leftOld = left;
    }

    if(rightOld != right) {
        LCD.setCursor(offset, 0);
        LCD.print(right);
        rightOld = right;
    }
}

