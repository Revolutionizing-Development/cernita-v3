# Spec 018 — Evaluation Chat Dialog

**Status:** Draft
**Priority:** P2
**Dependencies:** 011 (core evaluation), 003 (backend proxy)

## Problem

After the AI evaluates an item, users often want to challenge its recommendation, ask about specific details (e.g., "What would this cost in Italy?", "Is this really worth shipping?"), or provide additional context the photo didn't capture. Currently, the only option is to accept, override, or re-evaluate from scratch. There's no way to have a back-and-forth conversation about a specific item's evaluation.

## User Stories

### US-1: Challenge a recommendation
> As a user, I want to reply to an AI evaluation and say "But this is a family heirloom" or "This is a limited edition" so the AI can reconsider with that context.

### US-2: Ask for details
> As a user, I want to ask follow-up questions like "What would the transformer cost?" or "How much would this cost to replace in Italy?" so I can make a more informed decision.

### US-3: Provide missing context
> As a user, I want to tell the AI things the photo doesn't show, like "This is part of a set of 6" or "This was a wedding gift" so the evaluation accounts for that.

### US-4: See conversation history
> As a user, I want to see the full conversation thread for an item so I can review what was discussed when I come back to it later.

## Acceptance Criteria

### AC-1: Chat opens from result card
After evaluation completes, a "Discuss · Discuti" button appears on the result card. Tapping it opens a chat sheet anchored to that item's evaluation.

### AC-2: Chat opens from detail overlay
In the Log detail overlay, a "Discuss with AI · Discuti con AI" button opens the same chat sheet for any previously evaluated item.

### AC-3: Conversation is contextual
The AI receives the full evaluation context (photo, item name, rationale, decision, all metadata) as system context for the conversation, so the user doesn't have to repeat what the AI already knows.

### AC-4: Streaming responses
AI responses stream token-by-token using Server-Sent Events through `/api/anthropic-chat`, matching the existing streaming pattern. The user sees the response building in real time.

### AC-5: Updated recommendation
If the conversation changes the AI's assessment, it can issue an updated recommendation in a structured format. The user sees a "Update decision?" prompt with the new recommendation, which they can accept or ignore.

### AC-6: Conversation persisted
Chat messages are stored in a `cernita_chat_messages` table linked to the entry ID. Messages sync via Supabase Realtime so both users see the conversation.

### AC-7: Bilingual responses
AI responses follow the same bilingual pattern as evaluations: English primary, Italian translation for key terms and the final recommendation.

### AC-8: Mobile-first chat UI
The chat sheet is a bottom sheet on mobile (like the detail overlay pattern). Messages use speech-bubble styling. The input has a send button and supports multiline. The keyboard doesn't obscure the input.

### AC-9: Photo reference
The item's photo thumbnail is visible in the chat header so the user always knows which item they're discussing.

### AC-10: Conversation limit
Maximum 20 messages per conversation (10 user + 10 AI) to prevent runaway API costs. After the limit, the UI shows "Start a new evaluation to continue discussing this item."

## Data Model

### New table: `cernita_chat_messages`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| entry_id | int FK → cernita_entries | Which item this conversation is about |
| role | text | 'user' or 'assistant' |
| content | text | Message content |
| metadata | jsonb | Optional structured data (updated_recommendation, etc.) |
| created_at | timestamptz | |
| created_by | uuid FK → auth.users | Which user sent it |

### RLS Policy
- Users can read/write messages for entries in their household (same RLS pattern as cernita_entries)

## API

### POST `/api/anthropic-chat`

**Request body:**
```json
{
  "entry_id": 123,
  "message": "But this is a family heirloom from 1920",
  "conversation_history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response:** Server-Sent Events stream, same pattern as evaluation endpoint.

**System prompt includes:**
- Original evaluation result (decision, rationale, all metadata)
- Item photo (if available)
- Current settings (rates, thresholds)
- Instruction to issue `[UPDATED_RECOMMENDATION]` block if assessment changes

## UI States

### Chat sheet (bottom sheet)
1. **Header**: Item photo thumbnail, item name, current decision badge, close button
2. **Message list**: Scrollable, auto-scrolls to bottom on new messages
3. **Input area**: Multiline text input + send button, fixed to bottom above keyboard
4. **Streaming state**: Typing indicator with thinking ornament while AI responds

### Message bubbles
- **User messages**: Right-aligned, terracotta background, white text
- **AI messages**: Left-aligned, paper-dark background, ink text
- **Updated recommendation**: Special card format within AI message with accept/dismiss buttons

## Edge Cases

- **Offline**: Chat requires network. Show "Chat requires an internet connection" if offline.
- **Concurrent chat**: Both users can chat about the same item. Messages appear in real time via Realtime subscription.
- **Deleted item**: If the entry is deleted while a chat is open, close the chat and show a toast.
- **Rate limiting**: If the API returns 429, show "AI is busy — try again in a moment" and disable send for 30 seconds.
- **Empty message**: Send button disabled when input is empty or whitespace-only.

## Out of Scope

- Voice input (future enhancement)
- Image attachments in chat (user can't send additional photos mid-conversation)
- Chat search across items
- Chat export
- Typing indicators showing the other user is typing (only AI typing indicator)

## Migration

```sql
-- migration-018-chat-messages.sql

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
```

## Testing Checklist

- [ ] Chat opens from result card after evaluation
- [ ] Chat opens from detail overlay for existing items
- [ ] Messages stream in real time
- [ ] Conversation history is maintained across page reloads
- [ ] Updated recommendation can be accepted or dismissed
- [ ] Both users see messages in real time
- [ ] 20-message limit is enforced
- [ ] Mobile keyboard doesn't obscure input
- [ ] Chat works on both phones simultaneously
- [ ] Deleted item closes chat gracefully
