import fs from 'fs';
import path from 'path';
import { config } from '../config';

export type ConversationTurn = {
  role: 'user' | 'assistant';
  text: string;
  timestampMs: number;
};

export type ExtractedIntent = {
  type: 'schedule_meeting' | 'create_todo';
  title?: string;
  description?: string;
  whenStartIso?: string;
  whenEndIso?: string;
  participants?: string[];
  priority?: 'low' | 'medium' | 'high';
};

export type Session = {
  callSid: string;
  caller: string;
  conversation: ConversationTurn[];
  intents: ExtractedIntent[];
  done: boolean;
};

const callSidToSession: Record<string, Session> = {};

export function getOrCreateSession(callSid: string, caller: string): Session {
  if (!callSidToSession[callSid]) {
    callSidToSession[callSid] = {
      callSid,
      caller,
      conversation: [],
      intents: [],
      done: false,
    };
  }
  return callSidToSession[callSid];
}

export function appendTurn(session: Session, role: 'user' | 'assistant', text: string) {
  session.conversation.push({ role, text, timestampMs: Date.now() });
}

export function addIntents(session: Session, intents: ExtractedIntent[]) {
  session.intents.push(...intents);
}

export function markDone(session: Session) {
  session.done = true;
}

export function saveTranscript(session: Session) {
  const lines: string[] = [];
  lines.push(`CallSid: ${session.callSid}`);
  lines.push(`Caller: ${session.caller}`);
  lines.push(`Date: ${new Date().toISOString()}`);
  lines.push('---');
  for (const turn of session.conversation) {
    const ts = new Date(turn.timestampMs).toISOString();
    lines.push(`[${ts}] ${turn.role.toUpperCase()}: ${turn.text}`);
  }
  if (session.intents.length > 0) {
    lines.push('---');
    lines.push('Intents:');
    for (const intent of session.intents) {
      lines.push(JSON.stringify(intent));
    }
  }
  const filePath = path.join(config.transcriptsDir, `${session.callSid}.txt`);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return filePath;
}