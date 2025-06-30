# Tournament Application State Diagrams

## Local Tournament State Diagram

```
[Home Page] 
    ↓ (click "Local Tournament")
[Setup Screen]
    ↓ (enter participants, click "Start Tournament") 
    ↑ ("Back to Home" button)
    ↑ ("New Tournament" from anywhere)
[Bracket View]
    ↓ (click ready match OR "Start Next Match")
    ↑ (tournament complete → champion display → "New Tournament")
    ↔ (settings menu: change round duration, reset tournament)
[Active Match View]
    ↓ (select winner, confirm)
    ↑ ("Back to Bracket" button)
    ↑ ("End Match" button)
[Bracket View] (winner advanced, check for round completion)
    ↓ (if round complete → "Advance Round" button)
[Next Round] (repeat until tournament complete)
```

### Local Tournament States:
- **setup**: Participant entry and tournament configuration
- **bracket**: Tournament overview with clickable matches  
- **match**: Active match with winner selection
- **completed**: Tournament finished with champion

### Local Tournament Transitions:
- `setup → bracket`: Create tournament with participants
- `bracket → match`: Start specific match (click match OR start next)
- `match → bracket`: Complete match with winner selection
- `bracket → bracket`: Advance round when all matches complete
- `any → setup`: Reset/new tournament 
- `any → home`: Navigation home (with confirmation)

## Anonymous Tournament State Diagram

```
[Home Page]
    ↓ (click "Anonymous Voting")  
[Host Setup Screen]
    ↓ (enter details, click "Create Tournament")
    ↑ ("Back to Home" button)
[Waiting Room] 
    ↓ (voters join, click "Start Tournament")
    ↑ ("Back to Setup" button) 
    ↔ (show tournament code, connected voter count)
[Bracket View]
    ↓ (click ready match OR "Start Next Match") 
    ↑ (tournament complete → champion display)
    ↔ (settings menu + tournament code display)
[Active Match View] 
    ↓ (voting completes OR manual winner selection)
    ↑ ("Back to Bracket" button)
    ↔ (live vote tallies, timer, connected voters)
[Bracket View] (winner advanced, check for round completion)
    ↓ (if round complete → auto-advance OR "Advance Round")
[Next Round] (repeat until tournament complete)
```

### Anonymous Tournament States:
- **setup**: Host tournament configuration
- **waiting**: Voter connection and lobby
- **bracket**: Tournament overview with voter count + code
- **match**: Active match with live voting
- **completed**: Tournament finished with champion

### Anonymous Tournament Transitions:  
- `setup → waiting`: Create tournament and generate code
- `waiting → bracket`: Start tournament with connected voters
- `bracket → match`: Start match (triggers voter screens)
- `match → bracket`: Complete match via voting or manual selection
- `bracket → bracket`: Auto-advance round or manual advance
- `any → setup`: Reset tournament
- `any → home`: Navigation home (with confirmation)

## Voter Experience State Diagram (Anonymous Mode)

```
[Vote Entry Page]
    ↓ (enter 4-digit code)
    ↑ (invalid code error)
[Connection Waiting]
    ↓ (host starts tournament)
    ↑ (connection lost)
[Match Waiting Screen]
    ↓ (host starts match)
    ↔ (show tournament name, wait message)
[Voting Screen]
    ↓ (submit vote OR timer expires)
    ↔ (show match-up, timer, change vote)
[Results Screen]
    ↓ (next match OR tournament complete)
    ↔ (show winner, celebration)
[Match Waiting Screen] (repeat for next match)
    OR
[Tournament Complete] (champion announcement)
```

### Voter States:
- **entry**: Code entry and validation
- **waiting**: Connected, waiting for tournament start
- **match-waiting**: Between matches, waiting for next
- **voting**: Active voting on current match
- **results**: Match results display
- **complete**: Tournament finished

## Current Implementation Gaps

### Missing Navigation Features:
1. **No "Back to Bracket" button** in match view
2. **No accessible settings** during tournament
3. **No "Home" button** with confirmation dialog  
4. **No breadcrumb navigation**
5. **No tournament reset** option during gameplay

### Missing State Management:
1. **Tournament recovery** after page refresh unclear
2. **No confirmation dialogs** for destructive actions
3. **No progress indicators** showing tournament state
4. **Inconsistent error handling** across screens

### Required Additions:
1. Add navigation buttons to all screens
2. Add confirmation dialogs for state changes
3. Add breadcrumb/progress indicators  
4. Add settings menu accessible from bracket view
5. Add proper error states and recovery options
6. Add "pause tournament" functionality for breaks
