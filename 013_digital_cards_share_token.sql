-- Add share_token column to digital_cards table for public card sharing
ALTER TABLE digital_cards ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
