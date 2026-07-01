CREATE TABLE IF NOT EXISTS profile_products (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price       DECIMAL(10,2),
  description TEXT,
  image_url   TEXT,
  buy_link    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profile_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own products" ON profile_products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read products" ON profile_products FOR SELECT USING (true);

-- ── Chunk 2: Portfolio ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_portfolio (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  url         TEXT,
  category    TEXT,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profile_portfolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own portfolio" ON profile_portfolio FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read portfolio"      ON profile_portfolio FOR SELECT USING (true);

-- ── Chunk 3: Videos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_videos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  video_url     TEXT NOT NULL,
  video_type    TEXT NOT NULL DEFAULT 'youtube'
                  CHECK (video_type IN ('youtube','vimeo','upload')),
  thumbnail_url TEXT,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profile_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own videos" ON profile_videos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read videos"      ON profile_videos FOR SELECT USING (true);

-- ── Chunk 4: Music Tracks ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_music (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  artist        TEXT,
  audio_url     TEXT NOT NULL,
  cover_url     TEXT,
  duration_secs INT,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profile_music ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own music" ON profile_music FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read music"      ON profile_music FOR SELECT USING (true);
