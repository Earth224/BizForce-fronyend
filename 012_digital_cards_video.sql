-- Add video_url column to digital_cards table for Video Pitch feature
ALTER TABLE digital_cards ADD COLUMN IF NOT EXISTS video_url TEXT;
