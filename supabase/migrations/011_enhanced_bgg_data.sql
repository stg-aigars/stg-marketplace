-- Add weight, categories, and mechanics columns to games table
-- These are lazily enriched from BGG API via ensureGameMetadata()

ALTER TABLE games
  ADD COLUMN weight NUMERIC(4,2),       -- BGG average weight (complexity), e.g., 2.47
  ADD COLUMN categories TEXT[],          -- e.g., {'Economic', 'Negotiation'}
  ADD COLUMN mechanics TEXT[];           -- e.g., {'Dice Rolling', 'Trading'}
