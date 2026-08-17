import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { ChatSession, ChatMessage, ChatFolder } from '@lofiaistudio/shared';
import { dbOperations } from '../../db/index.js';

/**
 * Chat session & message CRUD + search + summarization API.
 *
 * Endpoints:
 *   GET    /api/chat/sessions                   — list all sessions
 *   POST   /api/chat/sessions                   — create a session
 *   GET    /api/chat/sessions/:id               — get session metadata
 *   PUT    /api/chat/sessions/:id               — update session (rename, pin, folder, summary)
 *   DELETE /api/chat/sessions/:id               — delete session + messages
 *   GET    /api/chat/sessions/:id/messages      — get messages for a session
 *   POST   /api/chat/sessions/:id/messages      — add a message
 *   GET    /api/chat/search?q=&sessionId=&limit= — search messages
 *   POST   /api/chat/sessions/:id/summarize     — generate summary via LLM
 */
export function createChatRouter(): Router {
  const router = Router();

  // ── Sessions ──────────────────────────────────────────────────────

  /** List all sessions (sorted by updatedAt desc) */
  router.get('/sessions', (_req, res) => {
    const sessions = dbOperations.getCollection<ChatSession>('chatSessions')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json({ success: true, data: sessions });
  });

  /** Create a new session */
  router.post('/sessions', (req, res) => {
    const now = new Date().toISOString();
    const body = req.body || {};
    const session: ChatSession = {
      id: body.id ?? uuidv4(),
      name: body.name ?? 'New Chat',
      modelId: body.modelId ?? '',
      systemPrompt: body.systemPrompt ?? '',
      parameters: body.parameters ?? undefined,
      memory: body.memory ?? undefined,
      folderId: body.folderId ?? undefined,
      pinnedMessageIds: [],
      tags: body.tags ?? [],
      branchParentId: body.branchParentId ?? undefined,
      branchRootId: body.branchRootId ?? undefined,
      summary: undefined,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    dbOperations.addToCollection<ChatSession>('chatSessions', session);
    res.status(201).json({ success: true, data: session });
  });

  /** Get a single session */
  router.get('/sessions/:id', (req, res) => {
    const sessions = dbOperations.getCollection<ChatSession>('chatSessions');
    const session = sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }
    res.json({ success: true, data: session });
  });

  /** Update session metadata */
  router.put('/sessions/:id', (req, res) => {
    const now = new Date().toISOString();
    const updates = req.body || {};
    const allowedFields = ['name', 'modelId', 'systemPrompt', 'parameters', 'memory',
      'folderId', 'pinnedMessageIds', 'tags', 'summary'];
    
    const filtered: Record<string, unknown> = { updatedAt: now };
    for (const field of allowedFields) {
      if (field in updates) {
        filtered[field] = updates[field];
      }
    }

    const updated = dbOperations.updateInCollection<ChatSession>('chatSessions', req.params.id, filtered as Partial<ChatSession>);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }
    res.json({ success: true, data: updated });
  });

  /** Delete a session and its messages */
  router.delete('/sessions/:id', (req, res) => {
    const sessionId = req.params.id;
    const deleted = dbOperations.deleteFromCollection('chatSessions', sessionId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }
    // Also delete all messages for this session
    const allMessages = dbOperations.getCollection<ChatMessage & { sessionId: string }>('chatMessages');
    const remaining = allMessages.filter((m) => m.sessionId !== sessionId);
    dbOperations.setCollection('chatMessages', remaining as unknown as Record<string, unknown>[]);
    
    res.json({ success: true, data: true });
  });

  // ── Messages ──────────────────────────────────────────────────────

  /** Get messages for a session */
  router.get('/sessions/:id/messages', (req, res) => {
    const sessionId = req.params.id;
    const allMessages = dbOperations.getCollection<ChatMessage & { sessionId: string }>('chatMessages');
    const messages = allMessages.filter((m) => m.sessionId === sessionId);
    res.json({ success: true, data: messages });
  });

  /** Add a message to a session */
  router.post('/sessions/:id/messages', (req, res) => {
    const sessionId = req.params.id;
    const body = req.body || {};
    
    const message: ChatMessage & { sessionId: string } = {
      id: body.id ?? uuidv4(),
      sessionId,
      role: body.role ?? 'user',
      content: body.content ?? '',
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      reactions: body.reactions ?? undefined,
      toolCalls: body.toolCalls ?? undefined,
      replyToId: body.replyToId ?? undefined,
      edited: body.edited ?? undefined,
      agentId: body.agentId ?? undefined,
      agentName: body.agentName ?? undefined,
      agentColor: body.agentColor ?? undefined,
      agentAvatarUrl: body.agentAvatarUrl ?? undefined,
    };

    dbOperations.addToCollection('chatMessages', message);

    // Update session message count & updatedAt
    const sessions = dbOperations.getCollection<ChatSession>('chatSessions');
    const sessionIdx = sessions.findIndex((s) => s.id === sessionId);
    if (sessionIdx >= 0) {
      const now = new Date().toISOString();
      dbOperations.updateInCollection<ChatSession>('chatSessions', sessionId, {
        messageCount: (sessions[sessionIdx].messageCount || 0) + 1,
        updatedAt: now,
      } as Partial<ChatSession>);
    }

    res.status(201).json({ success: true, data: message });
  });

  // ── Search ─────────────────────────────────────────────────────────

  /** Search messages across all sessions or within a specific session */
  router.get('/search', (req, res) => {
    const q = (req.query.q as string || '').toLowerCase().trim();
    const sessionId = req.query.sessionId as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    let messages = dbOperations.getCollection<ChatMessage & { sessionId: string }>('chatMessages');

    if (sessionId) {
      messages = messages.filter((m) => m.sessionId === sessionId);
    }

    if (q) {
      messages = messages.filter((m) => m.content.toLowerCase().includes(q));
    }

    // Sort by timestamp desc
    messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    messages = messages.slice(0, limit);

    res.json({ success: true, data: messages });
  });

  // ── Summarization ─────────────────────────────────────────────────

  /** Generate a summary for a session using the configured LLM */
  router.post('/sessions/:id/summarize', async (req, res) => {
    const sessionId = req.params.id;
    const sessions = dbOperations.getCollection<ChatSession>('chatSessions');
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    const allMessages = dbOperations.getCollection<ChatMessage & { sessionId: string }>('chatMessages');
    const messages = allMessages.filter((m) => m.sessionId === sessionId);
    if (messages.length === 0) {
      res.json({ success: true, data: { summary: 'Empty conversation.' } });
      return;
    }

    // Build conversation text for summarization (last 40 messages max)
    const conversationText = messages
      .slice(-40)
      .map((m) => `${m.role === 'user' ? 'User' : (m.agentName || 'Assistant')}: ${m.content}`)
      .join('\n');

    try {
      const response = await fetch(
        process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/api/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: session.modelId || 'gemma2:2b',
            messages: [
              {
                role: 'system',
                content: 'Summarize the following conversation in 2-3 sentences. Focus on key decisions, topics discussed, and outcomes.',
              },
              { role: 'user', content: conversationText },
            ],
            stream: false,
            options: { temperature: 0.3, num_predict: 256 },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`);
      }

      const data = await response.json() as { message?: { content: string } };
      const summary = data.message?.content || 'Could not generate summary.';

      // Persist summary
      dbOperations.updateInCollection<ChatSession>('chatSessions', sessionId, {
        summary,
      } as Partial<ChatSession>);

      res.json({ success: true, data: { summary } });
    } catch (error) {
      console.error('Failed to summarize session:', error);
      res.status(500).json({ success: false, error: 'Failed to generate summary' });
    }
  });

  return router;
}

/**
 * Folder CRUD for chat sessions.
 */
export function createFolderRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const folders = dbOperations.getCollection<ChatFolder>('chatFolders');
    res.json({ success: true, data: folders });
  });

  router.post('/', (req, res) => {
    const now = new Date().toISOString();
    const body = req.body || {};
    const folder: ChatFolder = {
      id: body.id ?? uuidv4(),
      name: body.name ?? 'Untitled Folder',
      color: body.color ?? undefined,
      sessionIds: body.sessionIds ?? [],
      createdAt: now,
      updatedAt: now,
    };
    dbOperations.addToCollection<ChatFolder>('chatFolders', folder);
    res.status(201).json({ success: true, data: folder });
  });

  router.put('/:id', (req, res) => {
    const updates = req.body || {};
    const updated = dbOperations.updateInCollection<ChatFolder>('chatFolders', req.params.id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    } as Partial<ChatFolder>);
    if (!updated) return res.status(404).json({ success: false, error: 'Folder not found' });
    res.json({ success: true, data: updated });
  });

  router.delete('/:id', (req, res) => {
    const deleted = dbOperations.deleteFromCollection('chatFolders', req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Folder not found' });
    res.json({ success: true, data: true });
  });

  return router;
}
