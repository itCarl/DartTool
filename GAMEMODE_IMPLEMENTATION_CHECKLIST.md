# Game Mode Implementation Checklist

Use this checklist when adding a new game mode to ensure you don't miss any important steps.

## 📋 Pre-Implementation

- [ ] Plan your game mode's rules and win conditions
- [ ] Sketch out the game state variables you'll need
- [ ] Identify how scoring works
- [ ] Plan how players advance through turns
- [ ] Decide on serialization format for state display

## 📝 Create the Header File

- [ ] Create `src/dart/[YourGameMode]GameMode.h`
- [ ] Define class inheriting from `GameMode`
- [ ] Declare all pure virtual methods from base class:
  - [ ] `reset()`
  - [ ] `processDartThrow(int score)`
  - [ ] `serialize(JsonObject& obj)`
  - [ ] `serializeForDisplay(JsonObject& obj)`
  - [ ] `deserialize(const JsonObject& obj)`
  - [ ] `deserializePartial(const JsonObject& obj)`
  - [ ] `getGameModeName()`
  - [ ] `getGameModeDescription()`
- [ ] Add game-mode-specific member variables
- [ ] Add game-mode-specific public methods (if needed)
- [ ] Include necessary headers (`GameMode.h`, `DartGameStatus.h`)

## 💻 Create the Implementation File

- [ ] Create `src/dart/[YourGameMode]GameMode.cpp`
- [ ] Implement constructor - initialize all member variables
- [ ] Implement `reset()` - clear all state and prepare for fresh game
- [ ] Implement `getStatus()` - return current game status
- [ ] Implement `setStatus()` - update status with debug output
- [ ] Implement `getStatusString()` - convert status to string
- [ ] Implement `processDartThrow()` - your core game logic:
  - [ ] Validate score (0-25 or your range)
  - [ ] Check if game is running
  - [ ] Check if player's turn is complete
  - [ ] Apply game-specific rules
  - [ ] Update player state
  - [ ] Check for win/loss conditions
  - [ ] Advance players/turns as needed
  - [ ] Return DartThrowResult with appropriate values
- [ ] Implement `serialize()` - save complete game state
- [ ] Implement `serializeForDisplay()` - minimal display data
- [ ] Implement `deserialize()` - restore complete game state
- [ ] Implement `deserializePartial()` - handle game updates

## 🏭 Update GameModeFactory

**File: `src/dart/GameModeFactory.h`**

- [ ] Add `#include "[YourGameMode]GameMode.h"` at top
- [ ] Update `createGameMode()` method:
  - [ ] Add case for your game mode name
  - [ ] Create instance with `std::make_unique<[YourGameMode]GameMode>()`
  - [ ] Test with different parameters if applicable
- [ ] Update `getAvailableGameModes()` method:
  - [ ] Add your mode name to the modes array
  - [ ] Update `modeCount` variable
- [ ] Update `getGameModeDescription()` method:
  - [ ] Add case for your mode name
  - [ ] Return human-readable description

## 🔧 Integration

- [ ] Add include in `src/server/server.cpp` (if factory wasn't already included)
- [ ] Update web menu/UI to show new game mode as an option
- [ ] Test that factory creates mode correctly
- [ ] Verify mode is listed in `getAvailableGameModes()`

## 🧪 Testing

- [ ] Create test/debug code to verify:
  - [ ] Constructor initializes correctly
  - [ ] `reset()` clears all state
  - [ ] `processDartThrow()` accepts valid throws
  - [ ] `processDartThrow()` rejects invalid throws
  - [ ] Turn progression works correctly
  - [ ] Win condition is detected properly
  - [ ] `serialize()` produces valid JSON
  - [ ] `deserialize()` restores state correctly
  - [ ] Game mode can be selected from factory
  - [ ] Game mode can be started successfully

### Manual Testing Scenarios

- [ ] Start game with 2+ players
- [ ] All players throw at least once
- [ ] Verify player turn progression
- [ ] Check display shows correct current player
- [ ] Win the game with first player
- [ ] Win the game with last player
- [ ] Test with different player counts
- [ ] Abort game mid-game
- [ ] Restart game after completion
- [ ] Test undo functionality (if supported)

## 📊 State Management Testing

- [ ] `serialize()` produces valid JSON
- [ ] JSON includes all necessary fields
- [ ] `serializeForDisplay()` is smaller than `serialize()`
- [ ] `deserialize()` restores complete state
- [ ] `deserializePartial()` updates only relevant fields
- [ ] Game can be saved and loaded
- [ ] State transitions work correctly (unknown → initialised → running → done)

## 🐛 Debugging & Validation

- [ ] Check all DEBUG_PRINTLN output makes sense
- [ ] Verify error messages are clear
- [ ] Test boundary conditions:
  - [ ] Zero score throws
  - [ ] Maximum score throws (25 or your max)
  - [ ] Single player games
  - [ ] Large player counts
  - [ ] Very long games
  - [ ] Quick wins

## 📦 Code Quality

- [ ] Code follows project style/conventions
- [ ] All methods have documentation comments
- [ ] Member variables are initialized
- [ ] No memory leaks (checked with smart pointers)
- [ ] No unused variables or includes
- [ ] Consistent error handling
- [ ] Debug output is helpful but not excessive

## 📚 Documentation

- [ ] Add description to `GAMEMODE_ARCHITECTURE.md`
- [ ] Add entry to game mode list in docs
- [ ] Document game-specific rules clearly
- [ ] Add example JSON serialization format
- [ ] Document any special member variables
- [ ] Add to `GAMEMODE_QUICK_REFERENCE.md` if complex

## 🎯 Final Verification

Before marking complete:

- [ ] Code compiles without errors or warnings
- [ ] All tests pass
- [ ] Game can be started from web menu
- [ ] Game progresses correctly through all states
- [ ] Game can be won
- [ ] Game can be aborted
- [ ] No regressions in existing functionality
- [ ] Documentation is complete and accurate

## 📋 Cleanup Checklist

- [ ] Remove any temporary debug code
- [ ] Remove any commented-out code
- [ ] Verify no hardcoded test values left
- [ ] Check for any console spam
- [ ] Test on actual hardware (if applicable)

---

## Common Issues & Solutions

### Issue: Mode not showing in available modes
**Solution:** Check `getAvailableGameModes()` array includes your mode

### Issue: Factory returns nullptr
**Solution:** Check `createGameMode()` has case for your mode name, check case sensitivity

### Issue: Compilation errors about pure virtual methods
**Solution:** Ensure all pure virtual methods from `GameMode` are implemented

### Issue: Game doesn't progress to next player
**Solution:** Check that `nextPlayer()` is called in `processDartThrow()` when turn is complete

### Issue: Serialization missing data
**Solution:** Ensure all relevant state is added to JSON in `serialize()`

### Issue: Display is broken
**Solution:** Check `serializeForDisplay()` includes all display-needed fields

---

**Remember:** The factory pattern makes adding new modes easy - focus on implementing your game rules correctly, and everything else will work!
