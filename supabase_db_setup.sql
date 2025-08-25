-- ====================================================================
-- SocioFi Business Networking Database Setup for Supabase
-- ====================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ====================================================================
-- CORE TABLES
-- ====================================================================

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  location TEXT,
  bio TEXT,
  phone TEXT,
  website TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{
    "mentor": false,
    "invest": false,
    "discuss": false,
    "collaborate": false,
    "hire": false
  }'::jsonb,
  skills TEXT[],
  interests TEXT[],
  stats JSONB DEFAULT '{
    "connections": 0,
    "collaborations": 0,
    "mentorships": 0,
    "investments": 0,
    "discussions": 0,
    "monitored": 0,
    "hired": 0
  }'::jsonb,
  settings JSONB DEFAULT '{
    "notifications": {
      "email": true,
      "push": false,
      "connections": true,
      "messages": true,
      "collaborations": true,
      "mentions": false
    },
    "privacy": {
      "profileVisibility": "public",
      "showEmail": false,
      "showPhone": false,
      "allowMessages": true
    }
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business cards table
CREATE TABLE IF NOT EXISTS business_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  extracted_data JSONB,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
  raw_text TEXT,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vector embeddings for LangChain integration - ONLY for AI agent operations
CREATE TABLE IF NOT EXISTS documents (
  id bigserial PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- corresponds to Document.pageContent in LangChain
  metadata JSONB DEFAULT '{}'::jsonb, -- corresponds to Document.metadata in LangChain
  embedding VECTOR(768), -- 768 dimensions for Google Gemini embeddings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Connections/matches table
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  compatibility_score FLOAT CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  match_reasons TEXT[],
  shared_interests TEXT[],
  complementary_skills TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(requester_id, recipient_id)
);

-- Messages table for chat functionality
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI processing jobs table
CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('ocr_extraction', 'profile_embedding', 'match_generation', 'semantic_search')),
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- User activity logs
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_data JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- INDEXES FOR PERFORMANCE
-- ====================================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location);
CREATE INDEX IF NOT EXISTS idx_users_skills ON users USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_users_interests ON users USING GIN(interests);
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN(preferences);
CREATE INDEX IF NOT EXISTS idx_users_stats ON users USING GIN(stats);

-- Business cards indexes
CREATE INDEX IF NOT EXISTS idx_business_cards_user_id ON business_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_business_cards_status ON business_cards(processing_status);
CREATE INDEX IF NOT EXISTS idx_business_cards_created_at ON business_cards(created_at);

-- Documents (vector embeddings) indexes for LangChain
CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

-- Connections indexes
CREATE INDEX IF NOT EXISTS idx_connections_requester_id ON connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_connections_recipient_id ON connections(recipient_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);
CREATE INDEX IF NOT EXISTS idx_connections_score ON connections(compatibility_score DESC);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, recipient_id, created_at);

-- AI jobs indexes
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_id ON ai_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_type ON ai_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON ai_jobs(created_at);

-- User activity indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view public profiles" ON users
  FOR SELECT USING (true); -- Allow public viewing for networking

-- Business cards policies
CREATE POLICY "Users can manage own business cards" ON business_cards
  FOR ALL USING (auth.uid() = user_id);

-- Documents (vector embeddings) policies - AI agents can read/write based on user_id
CREATE POLICY "Users can view own documents" ON documents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own documents" ON documents
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own documents" ON documents
  FOR DELETE USING (user_id = auth.uid());

-- Connections policies
CREATE POLICY "Users can view own connections" ON connections
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can create connection requests" ON connections
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update own connections" ON connections
  FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Messages policies
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- AI jobs policies
CREATE POLICY "Users can view own AI jobs" ON ai_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create AI jobs" ON ai_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User activity policies
CREATE POLICY "Users can view own activity" ON user_activity
  FOR SELECT USING (auth.uid() = user_id);

-- ====================================================================
-- FUNCTIONS
-- ====================================================================

-- Function to handle new user creation from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, title, company, location, bio, phone, website, avatar_url, preferences, stats)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'title',
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'location',
    NEW.raw_user_meta_data->>'bio',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'website',
    NEW.raw_user_meta_data->>'avatar_url',
    '{
      "mentor": false,
      "invest": false,
      "discuss": false,
      "collaborate": false,
      "hire": false
    }'::jsonb,
    '{
      "connections": 0,
      "collaborations": 0,
      "mentorships": 0,
      "investments": 0,
      "discussions": 0,
      "monitored": 0,
      "hired": 0
    }'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function for LangChain vector similarity search
CREATE OR REPLACE FUNCTION public.match_documents (
  query_embedding VECTOR(768),
  match_count INT DEFAULT NULL,
  filter JSONB DEFAULT '{}',
  user_id_filter UUID DEFAULT NULL
) RETURNS TABLE (
  id BIGINT,
  user_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.user_id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE metadata @> filter
    AND (user_id_filter IS NULL OR documents.user_id = user_id_filter)
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get conversation messages
CREATE OR REPLACE FUNCTION public.get_conversation_messages(
  user1_id UUID,
  user2_id UUID,
  limit_count INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  sender_id UUID,
  recipient_id UUID,
  content TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.sender_id, m.recipient_id, m.content, m.read_at, m.created_at
  FROM messages m
  WHERE (m.sender_id = user1_id AND m.recipient_id = user2_id)
     OR (m.sender_id = user2_id AND m.recipient_id = user1_id)
  ORDER BY m.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update connection stats
CREATE OR REPLACE FUNCTION public.update_connection_stats()
RETURNS TRIGGER AS $$
DECLARE
  requester_connections_count INTEGER;
  recipient_connections_count INTEGER;
BEGIN
  -- Update requester's connection count in stats
  SELECT COUNT(*) INTO requester_connections_count
  FROM connections 
  WHERE (requester_id = NEW.requester_id OR recipient_id = NEW.requester_id) 
  AND status = 'accepted';
  
  UPDATE users 
  SET stats = jsonb_set(stats, '{connections}', requester_connections_count::text::jsonb)
  WHERE id = NEW.requester_id;
  
  -- Update recipient's connection count in stats
  SELECT COUNT(*) INTO recipient_connections_count
  FROM connections 
  WHERE (requester_id = NEW.recipient_id OR recipient_id = NEW.recipient_id) 
  AND status = 'accepted';
  
  UPDATE users 
  SET stats = jsonb_set(stats, '{connections}', recipient_connections_count::text::jsonb)
  WHERE id = NEW.recipient_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- TRIGGERS
-- ====================================================================

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updating updated_at on users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updating updated_at on connections
DROP TRIGGER IF EXISTS update_connections_updated_at ON connections;
CREATE TRIGGER update_connections_updated_at
  BEFORE UPDATE ON connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updating connection stats
DROP TRIGGER IF EXISTS update_connection_stats_trigger ON connections;
CREATE TRIGGER update_connection_stats_trigger
  AFTER INSERT OR UPDATE ON connections
  FOR EACH ROW EXECUTE FUNCTION public.update_connection_stats();

-- ====================================================================
-- INITIAL DATA / SEEDS (Optional)
-- ====================================================================

-- Insert some sample skill categories
DO $$
BEGIN
  -- This is just for reference, actual skills will be user-defined
  -- You can add sample data here if needed
END $$;

-- ====================================================================
-- VIEWS FOR COMMON QUERIES
-- ====================================================================

-- View for user profiles with connection info
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT 
  u.*,
  CASE 
    WHEN u.avatar_url IS NOT NULL THEN u.avatar_url
    ELSE 'https://via.placeholder.com/150x150?text=' || LEFT(u.name, 1)
  END AS display_avatar_url
FROM users u;

-- View for active connections
CREATE OR REPLACE VIEW public.active_connections AS
SELECT 
  c.*,
  u1.name AS requester_name,
  u1.title AS requester_title,
  u1.company AS requester_company,
  u2.name AS recipient_name,
  u2.title AS recipient_title,
  u2.company AS recipient_company
FROM connections c
JOIN users u1 ON c.requester_id = u1.id
JOIN users u2 ON c.recipient_id = u2.id
WHERE c.status = 'accepted';

-- ====================================================================
-- SECURITY NOTES
-- ====================================================================

/*
1. All tables have RLS enabled
2. Users can only access their own data by default
3. Public profile viewing is allowed for networking
4. Sensitive operations use SECURITY DEFINER functions
5. All foreign keys have proper CASCADE deletes
6. Input validation through CHECK constraints
7. Indexes optimized for common query patterns
8. Vector search optimized with IVFFlat index
*/

-- ====================================================================
-- SETUP COMPLETION
-- ====================================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Enable realtime for chat functionality
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE connections;

SELECT 'Database setup completed successfully!' AS status;
