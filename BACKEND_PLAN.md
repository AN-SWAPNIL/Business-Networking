# SocioFi Business Networking Backend Architecture Plan

## Project Analysis Summary

**NetworkPro** is a professional business networking application with the following core features:

- **Business Card OCR**: Upload and extract information from business cards
- **User Profiles**: Complete professional profiles with preferences (mentor, invest, discuss, collaborate, hire)
- **Smart Matching**: AI-powered compatibility scoring based on location, interests, skills, and collaboration preferences
- **Directory**: Browse and search professional network
- **Connections**: Connect with other professionals

---

## Key Recommendations

**Backend Architecture**: Next.js API Routes + Supabase + LangGraph

- **Why**: Keeps everything in one codebase, leverages your existing Next.js setup
- **Supabase**: Handles auth, database, file storage, and vector operations (pgvector)
- **LangGraph**: Perfect for your two-agent system

## The Two AI Agents You Mentioned

### Agent 1: Document Processing & Storage Agent

- **OCR Extraction**: Tesseract.js + Gemini Vision for business card text extraction
- **Data Validation**: Clean and structure extracted data
- **Vector Embeddings**: Generate embeddings for semantic search
- **Storage**: Save to Supabase with vector storage

### Agent 2: Matching & Retrieval Agent

- **Profile Analysis**: Understand user preferences and goals
- **Vector Search**: Find semantically similar professionals
- **Compatibility Scoring**: Multi-factor scoring (location, interests, skills, preferences)
- **Reason Generation**: AI-generated explanations for why people match

## Database Design

The plan includes a complete PostgreSQL schema with:

- Users, business cards, connections, messages tables
- Vector embeddings table for semantic search
- AI job tracking for async processing
- Proper indexes and RLS security policies

## Why This Architecture Works Best

1. **Unified Codebase**: Everything in Next.js means shared types, easier deployment
2. **Vector Search**: Supabase pgvector handles similarity search natively
3. **Real-time**: Supabase realtime for instant messaging/notifications
4. **Scalable**: Can handle growth from MVP to production
5. **Cost-Effective**: ~$85-235/month vs separate backend infrastructure

---

## Backend Technology Stack

### Core Infrastructure

- **Framework**: Next.js 15 API Routes (app/api directory)
- **Database**: Supabase PostgreSQL + Vector Store (pgvector)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage (business card images)
- **AI/ML**: Google Gemini 1.5 Flash via LangChain/LangGraph
- **Vector Operations**: Supabase Vector (pgvector extension)

### Key Libraries

```json
{
  "@supabase/supabase-js": "^2.45.0",
  "langchain": "^0.3.0",
  "langgraph": "^0.1.0",
  "@google/generative-ai": "^0.21.0",
  "@supabase/functions-js": "^2.4.1",
  "tesseract.js": "^5.1.0",
  "sharp": "^0.33.5",
  "zod": "^3.25.67"
}
```

---

## Database Schema (Supabase)

### Core Tables

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  location TEXT,
  bio TEXT,
  phone TEXT,
  website TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  skills TEXT[],
  interests TEXT[],
  connections_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Business cards table
CREATE TABLE business_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  extracted_data JSONB,
  processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, error
  raw_text TEXT,
  confidence_score FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vector embeddings for business cards and profiles
CREATE TABLE profile_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, -- 'profile', 'business_card', 'skills', 'bio'
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI/Gemini embedding dimension
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Connections/matches
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, accepted, declined, blocked
  compatibility_score FLOAT,
  match_reasons TEXT[],
  shared_interests TEXT[],
  complementary_skills TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(requester_id, recipient_id)
);

-- Messages (basic chat)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- AI processing jobs
CREATE TABLE ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL, -- 'ocr_extraction', 'profile_embedding', 'match_generation'
  status TEXT DEFAULT 'queued', -- queued, processing, completed, failed
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### Indexes & Extensions

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Indexes for performance
CREATE INDEX idx_profile_embeddings_user_id ON profile_embeddings(user_id);
CREATE INDEX idx_profile_embeddings_content_type ON profile_embeddings(content_type);
CREATE INDEX idx_connections_requester_id ON connections(requester_id);
CREATE INDEX idx_connections_recipient_id ON connections(recipient_id);
CREATE INDEX idx_connections_status ON connections(status);
CREATE INDEX idx_business_cards_user_id ON business_cards(user_id);
CREATE INDEX idx_business_cards_status ON business_cards(processing_status);

-- Vector similarity search index
CREATE INDEX idx_profile_embeddings_vector ON profile_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## AI Agent Architecture (LangGraph)

### Agent 1: Document Processing & Storage Agent

**Purpose**: Process business cards, extract information, and create vector embeddings

```typescript
// Agent workflow
const documentProcessingAgent = new StateGraph({
  channels: {
    image: Annotator.of<string>(), // base64 image
    extracted_data: Annotator.of<BusinessCardData>(),
    embeddings: Annotator.of<number[]>(),
    user_id: Annotator.of<string>(),
  },
})
  .addNode("ocr_extraction", ocrExtractionNode)
  .addNode("data_validation", dataValidationNode)
  .addNode("embedding_generation", embeddingGenerationNode)
  .addNode("storage", storageNode)
  .addEdge("ocr_extraction", "data_validation")
  .addEdge("data_validation", "embedding_generation")
  .addEdge("embedding_generation", "storage");
```

**Capabilities**:

- OCR text extraction from business card images using Tesseract.js + Gemini Vision
- Data validation and cleaning using structured output parsing
- Generate embeddings for extracted information
- Store processed data and embeddings in Supabase

### Agent 2: Matching & Retrieval Agent

**Purpose**: Find compatible professionals and generate intelligent matches

```typescript
// Agent workflow
const matchingAgent = new StateGraph({
  channels: {
    user_profile: Annotator.of<UserProfile>(),
    candidate_matches: Annotator.of<UserProfile[]>(),
    compatibility_scores: Annotator.of<MatchResult[]>(),
    final_matches: Annotator.of<Match[]>(),
  },
})
  .addNode("profile_analysis", profileAnalysisNode)
  .addNode("vector_search", vectorSearchNode)
  .addNode("compatibility_scoring", compatibilityScoringNode)
  .addNode("reason_generation", reasonGenerationNode)
  .addNode("ranking", rankingNode);
```

**Capabilities**:

- Semantic search using vector embeddings for similar professionals
- Multi-factor compatibility scoring (preferences, location, skills, interests)
- AI-generated match reasoning and explanations
- Dynamic ranking based on user activity and preferences

---

## API Routes Structure

```
app/api/
├── auth/
│   ├── signup/route.ts
│   ├── signin/route.ts
│   └── signout/route.ts
├── users/
│   ├── route.ts                    # GET /api/users (search), POST /api/users
│   ├── [id]/route.ts               # GET, PUT, DELETE /api/users/[id]
│   ├── [id]/connections/route.ts   # GET user connections
│   └── me/route.ts                 # GET, PUT current user profile
├── business-cards/
│   ├── route.ts                    # POST /api/business-cards (upload)
│   ├── [id]/route.ts               # GET, DELETE /api/business-cards/[id]
│   └── process/route.ts            # POST /api/business-cards/process
├── matches/
│   ├── route.ts                    # GET /api/matches (for current user)
│   ├── generate/route.ts           # POST /api/matches/generate (trigger matching)
│   └── [id]/route.ts               # GET match details
├── connections/
│   ├── route.ts                    # GET user connections, POST new connection
│   ├── [id]/route.ts               # PUT (accept/decline), DELETE connection
│   └── requests/route.ts           # GET pending connection requests
├── messages/
│   ├── route.ts                    # GET messages, POST new message
│   ├── conversations/route.ts      # GET conversation list
│   └── [conversationId]/route.ts   # GET messages in conversation
├── search/
│   ├── users/route.ts              # POST /api/search/users (vector + text search)
│   ├── semantic/route.ts           # POST /api/search/semantic (AI-powered search)
│   └── filters/route.ts            # GET available filter options
└── ai/
    ├── embeddings/route.ts         # POST generate embeddings
    ├── extract/route.ts            # POST OCR + data extraction
    └── analyze/route.ts            # POST profile analysis
```

---

## Key Implementation Details

### 1. Business Card Processing Pipeline

```typescript
// app/api/business-cards/process/route.ts
export async function POST(request: Request) {
  const { imageUrl, userId } = await request.json();

  // Trigger Document Processing Agent
  const agent = createDocumentProcessingAgent();
  const result = await agent.invoke({
    image: imageUrl,
    user_id: userId,
  });

  return NextResponse.json(result);
}
```

### 2. Vector Similarity Search

```typescript
// Semantic search for similar professionals
async function findSimilarProfiles(
  userEmbedding: number[],
  limit: number = 10
) {
  const { data } = await supabase.rpc("match_profiles", {
    query_embedding: userEmbedding,
    match_threshold: 0.7,
    match_count: limit,
  });
  return data;
}
```

### 3. Real-time Match Generation

```typescript
// app/api/matches/generate/route.ts
export async function POST(request: Request) {
  const { userId } = await request.json();

  // Get user profile and preferences
  const userProfile = await getUserProfile(userId);

  // Trigger Matching Agent
  const matchingAgent = createMatchingAgent();
  const matches = await matchingAgent.invoke({
    user_profile: userProfile,
  });

  // Store matches in database
  await storeMatches(userId, matches);

  return NextResponse.json({ matches });
}
```

---

## Supabase Configuration

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_API_KEY=your_gemini_api_key
```

### Row Level Security (RLS) Policies

```sql
-- Users can only read/update their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Business cards are private to the owner
CREATE POLICY "Users can manage own business cards" ON business_cards
  FOR ALL USING (auth.uid() = user_id);

-- Connections visibility
CREATE POLICY "Users can view own connections" ON connections
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = recipient_id);
```

---

## Deployment & Monitoring

### Supabase Edge Functions (Optional)

For heavy AI processing, deploy edge functions:

```typescript
// supabase/functions/process-business-card/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { image } = await req.json();

  // Run OCR and AI processing
  const result = await processBusinessCard(image);

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### Performance Monitoring

- Supabase Dashboard for database metrics
- Next.js analytics for API performance
- Vector search performance tracking
- AI processing job queue monitoring

---

## Development Phases

### Phase 1: Core Infrastructure (Week 1-2)

- [ ] Set up Supabase project and database schema
- [ ] Implement user authentication and basic CRUD
- [ ] Create business card upload and storage
- [ ] Set up basic OCR with Tesseract.js

### Phase 2: AI Integration (Week 3-4)

- [ ] Integrate Google Gemini for enhanced OCR
- [ ] Implement LangGraph agents
- [ ] Set up vector embeddings and similarity search
- [ ] Create matching algorithm with AI explanations

### Phase 3: Features & Polish (Week 5-6)

- [ ] Implement real-time messaging
- [ ] Add advanced search and filtering
- [ ] Create admin dashboard
- [ ] Performance optimization and caching

### Phase 4: Production Ready (Week 7-8)

- [ ] Security hardening and RLS policies
- [ ] Rate limiting and abuse prevention
- [ ] Monitoring and error tracking
- [ ] Load testing and scaling preparation

---

## Cost Estimation (Monthly)

- **Supabase Pro**: $25/month (includes 8GB database, 100GB bandwidth)
- **Google Gemini API**: ~$50-200/month (depending on usage)
- **Supabase Storage**: ~$10/month for business card images
- **Total**: ~$85-235/month for production workload

---

This architecture provides a scalable, AI-powered backend that can handle business card processing, intelligent matching, and professional networking features while leveraging modern technologies like Supabase and LangGraph for optimal performance and developer experience.
