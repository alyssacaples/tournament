# Tournament Navigation Test Cases & State Analysis

## Current Navigation Issues Identified
1. **Missing Back/Navigation Buttons**: Users can get stuck in screens without clear exit paths
2. **Inconsistent State Management**: Different screens handle navigation differently  
3. **No Clear User Journey**: Path from setup → bracket → match → completion is unclear

## Test Cases for Local Tournament Flow

### Test Case 1: Complete Local Tournament Flow
**Starting State**: User on home page
**Steps**:
1. Click "Local Tournament" 
2. Enter tournament name and participants
3. Click "Start Tournament" → Should go to bracket view
4. Click on a ready match → Should go to match view  
5. Select winner → Should return to bracket with winner advanced
6. Complete all matches in round → Should show "Advance Round" button
7. Click "Advance Round" → Should create next round matches
8. Repeat until tournament complete → Should show champion

**Expected Navigation Elements**:
- Setup screen: "Back to Home" button
- Bracket screen: "Settings" (top-right), "Back to Home", "New Tournament" 
- Match screen: "Back to Bracket" button
- All screens: Clear breadcrumb or header showing current state

### Test Case 2: Tournament Recovery After Page Refresh
**Starting State**: Tournament in progress (any screen)
**Steps**:
1. Refresh page → Should restore to correct screen with saved state
2. Navigate between screens → State should persist
3. Clear browser data → Should return to setup

### Test Case 3: Navigation Edge Cases
**Test scenarios**:
- Back button from match when no bracket state
- Skip matches with single participants  
- Navigate away during active match
- Reset tournament mid-game

## Test Cases for Anonymous Tournament Flow

### Test Case 4: Anonymous Host Setup Flow
**Starting State**: User on home page
**Steps**:
1. Click "Anonymous Voting"
2. Enter tournament details → Should generate 4-digit code
3. Show waiting room with code display
4. Wait for voters to join → Show connected count
5. Click "Start Tournament" → Should go to bracket view
6. Continue with same bracket flow as local mode

**Expected Navigation Elements**:
- Setup screen: "Back to Home" button
- Waiting room: "Back to Setup", tournament code display, connected count
- All other screens: Same as local + tournament code visible

### Test Case 5: Voter Connection Flow
**Starting State**: Voter on phone/tablet
**Steps**:
1. Go to /vote page
2. Enter 4-digit code → Should validate and connect
3. See waiting screen → Should show tournament name
4. Host starts match → Should show voting interface
5. Submit vote → Should show confirmation
6. Match ends → Should show results and return to waiting

## Required Navigation Improvements

### 1. Add Missing Navigation Buttons
- **Back to Bracket** button in match view
- **Settings** menu in bracket view (top-right gear icon)
- **Home** button accessible from all screens
- **New Tournament** option that clears current state

### 2. Add Breadcrumb Navigation
```
Home > Local Tournament > Bracket > Match
Home > Anonymous > Setup > Waiting > Bracket > Match
```

### 3. Add State Indicators
- Current round/total rounds
- Tournament progress percentage
- Match completion status

### 4. Add Confirmation Dialogs
- "Are you sure you want to go home?" (loses tournament progress)
- "Reset tournament?" confirmation
- "End match without winner?" warning

## Priority Fixes Needed
1. **Missing back buttons** - Users get trapped in screens
2. **No settings access** - Can't change round duration during tournament  
3. **No tournament reset** - Can't restart without browser refresh
4. **Poor state recovery** - Confusing behavior on page refresh
5. **No navigation breadcrumbs** - Users don't know where they are in the flow
