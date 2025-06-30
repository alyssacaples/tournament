# Navigation Flow Test Cases

## Test Case 1: Local Tournament Complete Flow
**Objective**: Verify all navigation buttons work correctly in local tournament mode

### Steps:
1. **Start Local Tournament**
   - Go to http://localhost:3000
   - Click "Local Tournament" 
   - ✅ Should show participant setup screen with "Back to Home" button

2. **Setup Tournament**
   - Enter tournament name: "Test Tournament"
   - Add participants: "Alice, Bob, Charlie, David"
   - Click "Start Tournament"
   - ✅ Should go to bracket view with navigation bar at top

3. **Bracket View Navigation**
   - ✅ Should see: Round 1 of 2, Settings button, Reset button, Home button
   - ✅ Should see yellow pulsing matches ready to start
   - Click Settings button → ✅ Should open settings modal
   - Close settings modal

4. **Start and Complete a Match**
   - Click on a ready match (yellow border) 
   - ✅ Should go to match view with timer and controls
   - ✅ Should see "Return to Bracket" button
   - Select a winner and confirm
   - ✅ Should return to bracket view with winner advanced

5. **Test Reset Function**
   - Click "Reset" button in top navigation
   - ✅ Should show confirmation dialog
   - Click "Cancel" → should stay on bracket
   - Click "Reset" again → Click "OK"
   - ✅ Should reset all matches to starting state

6. **Test Home Navigation**
   - Click "Home" button
   - ✅ Should show confirmation dialog
   - Click "OK" → ✅ Should return to home page
   - Go back to /local → ✅ Should restore tournament state

## Test Case 2: Anonymous Tournament Flow
**Objective**: Verify navigation in anonymous voting mode

### Steps:
1. **Start Anonymous Tournament**
   - Go to http://localhost:3000
   - Click "Anonymous Voting"
   - ✅ Should show host setup with "Back to Home" button

2. **Create Tournament**
   - Enter tournament details and participants
   - Click "Create Tournament"
   - ✅ Should show waiting room with tournament code
   - ✅ Should see "Back to Setup" button

3. **Start Tournament**
   - Click "Start Tournament" (even with 0 voters for testing)
   - ✅ Should go to bracket view
   - ✅ Should see tournament code and "0 connected" in top bar
   - ✅ Should have all navigation buttons: Settings, Reset, Home

4. **Complete Tournament Flow**
   - Follow same match flow as local tournament
   - ✅ All navigation should work identically

## Test Case 3: Edge Cases
**Objective**: Test navigation in unusual scenarios

### Steps:
1. **Page Refresh Recovery**
   - Start tournament, go to bracket view
   - Refresh browser → ✅ Should restore to bracket view
   - Start a match, go to match view  
   - Refresh browser → ✅ Should restore to match view

2. **Navigation During Active Match**
   - Start a match
   - Click "Return to Bracket" → ✅ Should return to bracket
   - ✅ Match should still be marked as current match
   - Click same match again → ✅ Should return to match view

3. **Tournament Completion**
   - Complete all matches until champion
   - ✅ Should show "Tournament Complete!" in navigation
   - ✅ All navigation buttons should still work
   - ✅ Reset should work to start new tournament

## Expected Navigation Elements Summary

### All Screens Should Have:
- ✅ Clear visual hierarchy 
- ✅ Obvious way to go back/exit
- ✅ Current state indication

### Bracket View Should Have:
- ✅ Tournament info (name, round, code if anonymous)
- ✅ Settings button (opens modal)
- ✅ Reset button (with confirmation)  
- ✅ Home button (with confirmation)
- ✅ Connected voters count (if anonymous)

### Match View Should Have:
- ✅ "Return to Bracket" button
- ✅ Match controls (select winner, random, etc.)
- ✅ Timer controls

### Setup Screens Should Have:
- ✅ "Back to Home" button
- ✅ Clear form validation
- ✅ Progress indication

## Issues to Verify Fixed:
1. ✅ No more "trapped" screens without exit
2. ✅ Settings accessible during tournament
3. ✅ Tournament reset functionality works
4. ✅ Home navigation with state preservation
5. ✅ Consistent navigation patterns across modes
6. ✅ Proper confirmation dialogs for destructive actions

Run through these test cases to verify the navigation improvements work correctly!
