-- Anonymous Tournament Database Schema
-- Run this SQL in your Supabase SQL editor

-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(4) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('anonymous', 'participant')),
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed')),
  participants JSONB NOT NULL DEFAULT '[]',
  matches JSONB NOT NULL DEFAULT '[]',
  current_match_id VARCHAR(255),
  current_round INTEGER NOT NULL DEFAULT 1,
  max_participants INTEGER NOT NULL DEFAULT 16,
  round_duration INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  host_last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id VARCHAR(255) NOT NULL,
  voter_session_id UUID NOT NULL,
  participant_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, match_id, voter_session_id)
);

-- Create connections table
CREATE TABLE IF NOT EXISTS connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, session_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tournaments_code ON tournaments(code);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_votes_tournament_match ON votes(tournament_id, match_id);
CREATE INDEX IF NOT EXISTS idx_connections_tournament ON connections(tournament_id);

-- Enable Row Level Security (RLS)
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is anonymous)
-- Tournaments: anyone can read, only authenticated users can create/update
CREATE POLICY "Anyone can view tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Anyone can create tournaments" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tournaments" ON tournaments FOR UPDATE USING (true);

-- Votes: anyone can read/write (anonymous voting)
CREATE POLICY "Anyone can view votes" ON votes FOR SELECT USING (true);
CREATE POLICY "Anyone can create votes" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update votes" ON votes FOR UPDATE USING (true);

-- Connections: anyone can read/write (anonymous connections)
CREATE POLICY "Anyone can view connections" ON connections FOR SELECT USING (true);
CREATE POLICY "Anyone can create connections" ON connections FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update connections" ON connections FOR UPDATE USING (true);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update timestamps
CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_votes_updated_at BEFORE UPDATE ON votes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
