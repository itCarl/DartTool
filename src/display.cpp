#include "DartTool.h"

void initLCD()
{
    LCD.init();
    LCD.backlight();

    // load custom characters
    LCD.createChar(0, arrowUp);
    LCD.createChar(1, arrowDown);
    LCD.createChar(2, dart);

    LCD.home();
    printCentered("Initializing", 1);
    printCentered("==- DartTool -==", 2);
    delay(1000);
    clearRowWithAnimationBothSides(2, ANIMATION_DELAY_INIT);
}

void initAdvance(String text)
{
    clearRowWithAnimation(3);
    clearRowWithAnimation(2);
    printCenteredAnimated(2, text);
}

void initAdvanceDetails(String textFirstRow, String textSecondRow)
{
    // Clear both rows in parallel
    for (uint8_t i = 0; i < 20; i++) {
        LCD.setCursor(i, 2);
        LCD.print(" ");
        LCD.setCursor(i, 3);
        LCD.print(" ");
        delay(ANIMATION_DELAY_DEFAULT);
    }

    // Print both rows in parallel with centered text
    uint8_t textLen1 = textFirstRow.length();
    uint8_t padding1 = (20 - textLen1) / 2;
    uint8_t textLen2 = textSecondRow.length();
    uint8_t padding2 = (20 - textLen2) / 2;

    uint8_t maxLen = max(textLen1, textLen2);

    for (uint8_t i = 0; i < maxLen; i++) {
        if (i < textLen1) {
            LCD.setCursor(padding1 + i, 2);
            LCD.print(textFirstRow[i]);
        }
        if (i < textLen2) {
            LCD.setCursor(padding2 + i, 3);
            LCD.print(textSecondRow[i]);
        }
        delay(ANIMATION_DELAY_CHAR_WRITE);
    }
}

void showMessage(const char* msg)
{
    clearRow(0);
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

void clearRowSegment(uint8_t y, uint8_t start, uint8_t end)
{
    if (start > end || end >= 20) return; // Invalid range

    LCD.setCursor(start, y);
    for (uint8_t i = start; i <= end; i++) {
        LCD.print(" ");
    }
    LCD.setCursor(start, y);
}

void clearRowWithAnimation(uint8_t y, uint16_t delayMs)
{
    LCD.setCursor(0, y);
    for (uint8_t i = 0; i < 20; i++) {
        LCD.print(" ");
        delay(delayMs);
    }
    LCD.setCursor(0, y);
}

// Overload
void clearRowWithAnimation(uint8_t y)
{
    clearRowWithAnimation(y, ANIMATION_DELAY_DEFAULT);
}

void clearRowWithAnimationBothSides(uint8_t y, uint16_t delayMs)
{
    // Clear from both ends toward the center
    for (uint8_t i = 0; i < 10; i++) {
        LCD.setCursor(i, y);
        LCD.print(' ');
        LCD.setCursor(19 - i, y);
        LCD.print(' ');
        delay(delayMs);
    }
    LCD.setCursor(0, y);
}

// Overload
void clearRowWithAnimationBothSides(uint8_t y)
{
    clearRowWithAnimationBothSides(y, ANIMATION_DELAY_DEFAULT);
}

void clearRowWithScramble(uint8_t y, uint8_t scrambleCount, uint16_t delayMs)
{
    const char scrambleChars[] = "!@#$%^&*+-=~?";
    uint8_t charCount = sizeof(scrambleChars) - 1;

    // Scramble phase
    for (uint8_t iteration = 0; iteration < scrambleCount; iteration++) {
        LCD.setCursor(0, y);
        for (uint8_t i = 0; i < 20; i++) {
            LCD.print(scrambleChars[random(charCount)]);
        }
        delay(delayMs);
    }

    // Clear phase
    LCD.setCursor(0, y);
    for (uint8_t i = 0; i < 20; i++) {
        LCD.print(" ");
        delay(delayMs / 2);
    }
    LCD.setCursor(0, y);
}

// Overload
void clearRowWithScramble(uint8_t y, uint8_t scrambleCount)
{
    clearRowWithScramble(y, scrambleCount, ANIMATION_DELAY_DEFAULT);
}

void printCenteredAnimated(uint8_t y, String text, uint16_t writeDelayMs)
{
    uint8_t textLen = text.length();
    uint8_t padding = (20 - textLen) / 2;

    LCD.setCursor(padding, y);
    for (uint8_t i = 0; i < textLen; i++) {
        LCD.print(text[i]);
        delay(writeDelayMs);
    }
    LCD.setCursor(0, y);
}

// Overload
void printCenteredAnimated(uint8_t y, String text)
{
    printCenteredAnimated(y, text, ANIMATION_DELAY_CHAR_WRITE);
}

void printSpaceBetween(String left, String right)
{
    static String leftOld = "";
    static String rightOld = "";

    if (leftOld == left && rightOld == right) return; // No update needed
    // if (leftOld != left && rightOld != right) clearRow(0);

    uint8_t leftLength = left.length();
    uint8_t rightLength = right.length();
    uint8_t spaceBetween = 20 - (leftLength + rightLength);
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

void printCentered(String text, uint8_t row)
{

    // Truncate if too long
    if (text.length() >= 20) {
        LCD.setCursor(0, row);
        LCD.print(text.substring(0, 20));
        DEBUG_PRINT("Text too long");
        return;
    }

    uint8_t padding = (20 - text.length()) / 2;
    LCD.setCursor(padding, row);  // assumes printing on row 0
    LCD.print(text);

    // Optional: clear remaining characters on the line
    for (int i = padding + text.length(); i < 20; i++) {
        LCD.print(' ');
    }
}

    const char* bigDigitsTop[] = {
        " _ ", "   ", " _ ", " _ ", "   ", " _ ", " _ ", " _ ", " _ ", " _ "
    };

    const char* bigDigitsMid[] = {
        "| |", "  |", " _|", " _|", "|_|", "|_ ", "|_ ", "  |", "|_|", "|_|"
    };

    const char* bigDigitsBot[] = {
        "|_|", "  |", "|_ ", " _|", "  |", " _|", "|_|", "  |", "|_|", " _|"
    };
void drawBigNumber(uint16_t number, uint8_t col, uint8_t row) {
  String str = String(number);
  // Draw top
  LCD.setCursor(col, row);
  for (char c : str) {
    LCD.print(bigDigitsTop[c - '0']);
    LCD.print(' ');
  }
  // Draw middle
  LCD.setCursor(col, row + 1);
  for (char c : str) {
    LCD.print(bigDigitsMid[c - '0']);
    LCD.print(' ');
  }
  // Draw bottom
  LCD.setCursor(col, row + 2);
  for (char c : str) {
    LCD.print(bigDigitsBot[c - '0']);
    LCD.print(' ');
  }
}

/*
 * Display game state layout on 20x4 LCD
 *
 * Layout:
 * Row 0: Player name (truncated if needed) + Throws (X/3)
 * Row 1: Points remaining
 * Row 2: Last throw score (if available)
 * Row 3: Game status / Turn info
 */
void displayGameState(DartGame& game)
{
    LCD.clear();

    if (game.getStatus() == DartGameStatus::unknown || game.getStatus() == DartGameStatus::initialised) {
        printCentered("Ready to play!", 1);
        String gameMode = "Mode: " + game.getGameModeName();
        printCentered(gameMode, 2);
        return;
    }

    if (game.getStatus() == DartGameStatus::done) {
        printCentered("Game Over!", 1);
        Player& winner = game.getPlayerAt(0);
        // Find actual winner
        for (size_t i = 0; i < game.getPlayerCount(); i++) {
            if (game.getPlayerAt(i).hasWon()) {
                winner = game.getPlayerAt(i);
                break;
            }
        }
        printCentered(winner.getName() + " wins!", 2);
        return;
    }

    if (game.getPlayerCount() == 0) {
        printCentered("No players", 1);
        return;
    }

    // Get current player
    Player& currentPlayer = game.getPlayerAt(game.getCurrentPlayerIndex());
    uint16_t remainingPoints = game.getCurrentPlayerRemainingPoints();
    uint8_t throwCount = game.getThrowCounter();

    // Row 0: Player name + throw count
    String playerName = currentPlayer.getName();
    if (playerName.length() > 13) {
        playerName = playerName.substring(0, 12) + ".";
    }
    String throwInfo = "(" + String(throwCount) + "/3)";
    printSpaceBetween(playerName, throwInfo);

    // Row 1: Remaining points (large display)
    String pointsStr = String(remainingPoints);
    clearRow(1);
    printCentered(pointsStr, 1);

    // Row 2: Last throw info
    clearRow(2);
    std::vector<Throw> throws = currentPlayer.getThrows();
    if (throws.size() > 0) {
        Throw lastThrow = throws.back();
        String throwStr = lastThrow.toString() + " (" + String(lastThrow.getPoints()) + ")";
        printCentered(throwStr, 2);
    } else {
        printCentered("--", 2);
    }

    // Row 3: Turn and player count
    clearRow(3);
    String turnInfo = "Turn: " + String(game.getTurn() + 1);
    String playerInfo = "P" + String(game.getCurrentPlayerIndex() + 1) + "/" + String(game.getPlayerCount());
    printSpaceBetween(turnInfo, playerInfo);
}
