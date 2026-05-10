-- migration-018-chat-messages.sql
-- Spec 018: Evaluation chat dialog
-- Adds a chat messages table for in-evaluation AI conversations

CREATE TABLE cernita_chat_messages (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES cernita_entries(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for fast lookup by entry
CREATE INDEX idx_chat_messages_entry ON cernita_chat_messages(entry_id, created_at);

-- RLS
ALTER TABLE cernita_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read chat messages"
  ON cernita_chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Users can insert chat messages"
  ON cernita_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = created_by);
