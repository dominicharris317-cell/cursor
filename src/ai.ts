import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { z } from 'zod';
import { config } from './config';
import { ConversationTurn, ExtractedIntent } from './store/sessionStore';

const openai = new OpenAI({ apiKey: config.openAiApiKey });

export type EmbeddingEntry = {
  id: string;
  filePath: string;
  text: string;
  embedding: number[];
};

function loadEmbeddings(): EmbeddingEntry[] {
  try {
    const raw = fs.readFileSync(config.embeddingsPath, 'utf-8');
    const data = JSON.parse(raw) as EmbeddingEntry[];
    return data;
  } catch {
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

export async function retrieveKnowledge(query: string, topK = 4): Promise<{ filePath: string; text: string }[]> {
  const embeddings = loadEmbeddings();
  if (embeddings.length === 0) return [];
  const q = await openai.embeddings.create({
    input: query,
    model: 'text-embedding-3-small',
  });
  const qvec = q.data[0]?.embedding || [];
  const scored = embeddings.map(e => ({ e, score: cosineSimilarity(qvec, e.embedding) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => ({ filePath: s.e.filePath, text: s.e.text }));
}

const IntentSchema = z.object({
  intents: z.array(z.object({
    type: z.enum(['schedule_meeting', 'create_todo']),
    title: z.string().optional(),
    description: z.string().optional(),
    whenStartIso: z.string().datetime().optional(),
    whenEndIso: z.string().datetime().optional(),
    participants: z.array(z.string()).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
  }))
});

export async function generateAssistantTurn(conversation: ConversationTurn[]): Promise<{ reply: string; shouldEnd: boolean }> {
  const userLast = [...conversation].reverse().find(t => t.role === 'user');
  const knowledge = userLast ? await retrieveKnowledge(userLast.text).catch(() => []) : [];
  const knowledgeText = knowledge.map(k => `From ${k.filePath}: \n${k.text}`).join('\n\n');

  const system = `You are a polite voicemail AI assistant. Have a natural, concise conversation suitable for voice. If meeting details or tasks are discussed, clarify missing details. Keep replies under 2 sentences. End the conversation when the caller is done or you have enough info.`;
  const tools = knowledgeText ? `Relevant knowledge:\n${knowledgeText}` : '';
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...(tools ? [{ role: 'system', content: tools }] as any : []),
    ...conversation.map(t => ({ role: t.role, content: t.text } as const)),
  ];
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.3,
  });
  const reply = resp.choices[0]?.message?.content?.toString() || 'Okay.';

  // Decide to end via a small classifier prompt
  const endCheck = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Return only YES or NO. If the conversation sounds complete or a voicemail wrap-up is appropriate, answer YES, else NO.' },
      { role: 'user', content: conversation.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n') + `\nASSISTANT_NEXT: ${reply}` },
    ],
    temperature: 0,
  });
  const shouldEnd = (endCheck.choices[0]?.message?.content || 'NO').trim().toUpperCase().startsWith('Y');
  return { reply, shouldEnd };
}

export async function extractIntents(conversation: ConversationTurn[]): Promise<ExtractedIntent[]> {
  const prompt = `Extract meeting scheduling and todo creation intents discussed so far. Use ISO-8601 for dates. Participants as emails or names. If missing dates, omit them.`;
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: conversation.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n') },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  });
  const content = resp.choices[0]?.message?.content || '{"intents":[]}';
  const parsed = IntentSchema.safeParse(JSON.parse(content));
  if (!parsed.success) return [];
  return parsed.data.intents as ExtractedIntent[];
}