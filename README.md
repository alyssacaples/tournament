# Tournament Bracket App

A modern, interactive tournament bracket application built with Next.js, React, and TypeScript. Perfect for organizing and running single-elimination tournaments with real-time match management.

## Features

- **Dynamic Bracket Generation**: Supports any number of participants (2+) with optimized bracket structures
- **Fair Bye Distribution**: Ensures no participant gets more than one bye, with byes distributed only in the first round
- **Seeding Options**: Toggle between random placement and seeded tournaments
- **Real-time Match Management**: 
  - Configurable round timers
  - Interactive match selection
  - Automatic winner advancement
- **Visual Participant System**: Each participant gets a unique shape/color combination for easy identification
- **Responsive Design**: Clean, modern UI that works on all screen sizes
- **Tournament Controls**: 
  - Skip matches for single participants
  - Reset tournaments
  - Change participant lineups

## Screenshots

The app features a clean bracket view showing all rounds from first round through championship, with visual indicators for completed matches, active matches, and upcoming matches.

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tournament-bracket-app.git
cd tournament-bracket-app
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Create Tournament**: Start by entering participant names (one per line or comma-separated)
2. **Configure Settings**: 
   - Toggle seeding on/off (default: random)
   - Set round duration (default: 2 minutes)
3. **Run Tournament**: 
   - Click "Start Next Match" to begin matches
   - Use the timer and voting system to determine winners
   - Tournament automatically advances through rounds
4. **Tournament Management**:
   - Skip matches with only one participant
   - Reset tournament to start over
   - Change participant lineup

## Technical Details

### Bracket Algorithm

The app uses an optimized bracket generation algorithm that:
- Calculates the minimum number of rounds needed: `ceil(log2(participants))`
- Distributes byes fairly in the first round only
- Ensures balanced progression through all rounds
- Handles odd numbers of participants efficiently

### Architecture

- **Frontend**: Next.js 14 with React and TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React hooks with prop drilling
- **Icons**: Lucide React

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with modern React patterns and TypeScript for type safety
- Designed for real-world tournament hosting scenarios
- Optimized for both small and large tournaments
