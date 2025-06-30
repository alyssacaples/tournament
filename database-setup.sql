-- =============================================================================
-- TOURNAMENT APP - SUPABASE DATABASE SETUP
-- =============================================================================
-- This file contains all the SQL commands needed to set up the database
-- for the anonymous voting tournament feature.
--
-- Run these commands in your Supabase SQL Editor in the following order:
-- 1. Create Tables
-- 2. Create Indexes
-- 3. Enable Row Level Security
-- 4. Create Policies
-- 5. Optional: Create Functions and Triggers
-- =============================================================================

-- =============================================================================
-- 1. CREATE TABLES
-- =============================================================================

-- Main tournaments table
-- Stores tournament data, participants, and real-time state
CREATE TABLE IF NOT EXISTS tournaments (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(4) UNIQUE NOT NULL,
    tournament_data JSONB NOT NULL,
    participants JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    timer_active BOOLEAN DEFAULT FALSE,
    timer_remaining INTEGER DEFAULT 0,
    timer_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament votes table
-- Stores individual votes from voters for each match
CREATE TABLE IF NOT EXISTS tournament_votes (
    id BIGSERIAL PRIMARY KEY,
    tournament_code VARCHAR(4) NOT NULL,
    match_id VARCHAR(255) NOT NULL,
    participant_id VARCHAR(255) NOT NULL,
    voter_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_code, match_id, voter_id)
);

-- Tournament connections table
-- Tracks which voters are currently connected to each tournament
CREATE TABLE IF NOT EXISTS tournament_connections (
    id BIGSERIAL PRIMARY KEY,
    tournament_code VARCHAR(4) NOT NULL,
    voter_id VARCHAR(255) NOT NULL,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_code, voter_id)
);

-- =============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Indexes for tournaments table
CREATE INDEX IF NOT EXISTS idx_tournaments_code ON tournaments(code);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_at ON tournaments(created_at);

-- Indexes for tournament_votes table
CREATE INDEX IF NOT EXISTS idx_tournament_votes_code_match ON tournament_votes(tournament_code, match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_votes_code ON tournament_votes(tournament_code);
CREATE INDEX IF NOT EXISTS idx_tournament_votes_match_participant ON tournament_votes(match_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_tournament_votes_created_at ON tournament_votes(created_at);

-- Indexes for tournament_connections table
CREATE INDEX IF NOT EXISTS idx_tournament_connections_code_ping ON tournament_connections(tournament_code, last_ping);
CREATE INDEX IF NOT EXISTS idx_tournament_connections_code ON tournament_connections(tournament_code);
CREATE INDEX IF NOT EXISTS idx_tournament_connections_voter ON tournament_connections(voter_id);

-- =============================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_connections ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. CREATE RLS POLICIES
-- =============================================================================

-- Policies for tournaments table
-- Allow all operations for anonymous users (tournament app needs full access)
DROP POLICY IF EXISTS "Allow all operations on tournaments" ON tournaments;
CREATE POLICY "Allow all operations on tournaments" 
ON tournaments FOR ALL 
USING (true);

-- Policies for tournament_votes table
-- Allow all operations for voting functionality
DROP POLICY IF EXISTS "Allow all operations on tournament_votes" ON tournament_votes;
CREATE POLICY "Allow all operations on tournament_votes" 
ON tournament_votes FOR ALL 
USING (true);

-- Policies for tournament_connections table
-- Allow all operations for connection tracking
DROP POLICY IF EXISTS "Allow all operations on tournament_connections" ON tournament_connections;
CREATE POLICY "Allow all operations on tournament_connections" 
ON tournament_connections FOR ALL 
USING (true);

-- =============================================================================
-- 5. OPTIONAL: UTILITY FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on tournaments table
DROP TRIGGER IF EXISTS update_tournaments_updated_at ON tournaments;
CREATE TRIGGER update_tournaments_updated_at 
    BEFORE UPDATE ON tournaments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old connections (optional - can be run manually or via cron)
CREATE OR REPLACE FUNCTION cleanup_stale_connections(cleanup_interval_minutes INTEGER DEFAULT 5)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM tournament_connections 
    WHERE last_ping < NOW() - INTERVAL '1 minute' * cleanup_interval_minutes;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get active voter count for a tournament
CREATE OR REPLACE FUNCTION get_active_voter_count(tournament_code_param VARCHAR(4))
RETURNS INTEGER AS $$
DECLARE
    voter_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO voter_count
    FROM tournament_connections 
    WHERE tournament_code = tournament_code_param 
    AND last_ping > NOW() - INTERVAL '30 seconds';
    
    RETURN COALESCE(voter_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get vote tallies for a specific match
CREATE OR REPLACE FUNCTION get_vote_tallies(tournament_code_param VARCHAR(4), match_id_param VARCHAR(255))
RETURNS TABLE(participant_id VARCHAR(255), vote_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tv.participant_id,
        COUNT(*) as vote_count
    FROM tournament_votes tv
    WHERE tv.tournament_code = tournament_code_param 
    AND tv.match_id = match_id_param
    GROUP BY tv.participant_id
    ORDER BY vote_count DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 6. REALTIME SETUP
-- =============================================================================

-- Enable Realtime for all tables (run these in Supabase Dashboard > Settings > API)
-- Or use these ALTER statements:

-- Enable realtime for tournaments table
ALTER publication supabase_realtime ADD TABLE tournaments;

-- Enable realtime for tournament_votes table  
ALTER publication supabase_realtime ADD TABLE tournament_votes;

-- Enable realtime for tournament_connections table
ALTER publication supabase_realtime ADD TABLE tournament_connections;

-- =============================================================================
-- 7. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- =============================================================================

-- Uncomment these lines if you want to insert sample data for testing

/*
-- Sample tournament
INSERT INTO tournaments (code, tournament_data, participants, status) VALUES 
(
    'TEST',
    '{"id": "test-tournament", "name": "Test Tournament", "status": "active", "currentRound": 1}',
    '[{"id": "p1", "name": "Alice", "visualId": 0}, {"id": "p2", "name": "Bob", "visualId": 1}]',
    'active'
);

-- Sample connections
INSERT INTO tournament_connections (tournament_code, voter_id) VALUES 
('TEST', 'voter-1'),
('TEST', 'voter-2');

-- Sample votes
INSERT INTO tournament_votes (tournament_code, match_id, participant_id, voter_id) VALUES 
('TEST', 'match-1', 'p1', 'voter-1'),
('TEST', 'match-1', 'p2', 'voter-2');
*/

-- =============================================================================
-- 8. VERIFICATION QUERIES
-- =============================================================================

-- Run these queries to verify your setup is working correctly:

-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tournaments', 'tournament_votes', 'tournament_connections');

-- Check if indexes exist
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('tournaments', 'tournament_votes', 'tournament_connections');

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('tournaments', 'tournament_votes', 'tournament_connections');

-- Check if policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('tournaments', 'tournament_votes', 'tournament_connections');

-- =============================================================================
-- NOTES
-- =============================================================================

/*
IMPORTANT NOTES:

1. ENVIRONMENT VARIABLES:
   Make sure you have these in your .env.local file:
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

2. REALTIME:
   The realtime functionality requires enabling it in Supabase Dashboard.
   Go to Settings > API > Realtime and enable it for your tables.

3. POLICIES:
   The current policies allow all operations for simplicity.
   In production, you might want more restrictive policies.

4. CLEANUP:
   The cleanup function can be scheduled to run periodically to remove
   stale connections. You can set up a cron job or use Supabase Edge Functions.

5. TESTING:
   Use the sample data section to test your setup.
   The verification queries help ensure everything is configured correctly.

6. SCALING:
   For high-traffic tournaments, consider:
   - Adding more specific indexes
   - Implementing connection pooling
   - Using read replicas for vote tallies
   - Caching frequently accessed data
*/
