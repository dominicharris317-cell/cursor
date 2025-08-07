import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { config } from '../config';
import { ExtractedIntent } from '../store/sessionStore';

function toEvent(intent: ExtractedIntent) {
  if (!intent.whenStartIso || !intent.whenEndIso || !intent.title) return null;
  return {
    summary: intent.title,
    description: intent.description || '',
    start: { dateTime: intent.whenStartIso },
    end: { dateTime: intent.whenEndIso },
    attendees: (intent.participants || []).map(e => ({ email: e })),
  };
}

async function createGoogleEvents(intents: ExtractedIntent[]) {
  if (config.google.calendarDisabled || !config.google.credentialsPath || !config.google.tokenPath) {
    return { created: 0, skipped: intents.length, reason: 'Google Calendar disabled or not configured' };
  }
  try {
    const creds = JSON.parse(fs.readFileSync(config.google.credentialsPath, 'utf-8'));
    const token = JSON.parse(fs.readFileSync(config.google.tokenPath, 'utf-8'));
    const { client_secret, client_id, redirect_uris } = creds.installed || creds.web;
    const oAuth2Client = new (google as any).auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(token);
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    let created = 0;
    for (const intent of intents) {
      if (intent.type !== 'schedule_meeting') continue;
      const event = toEvent(intent);
      if (!event) continue;
      try {
        await calendar.events.insert({ calendarId: config.google.calendarId, requestBody: event });
        created++;
      } catch (e) {
        // ignore individual failures
      }
    }
    return { created, skipped: intents.length - created };
  } catch (e) {
    return { created: 0, skipped: intents.length, reason: 'Google credentials invalid or missing' };
  }
}

function writeIcsFallback(intents: ExtractedIntent[]) {
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  for (const intent of intents) {
    if (intent.type !== 'schedule_meeting' || !intent.whenStartIso || !intent.whenEndIso || !intent.title) continue;
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@local`;    
    const dtStart = intent.whenStartIso.replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dtEnd = intent.whenEndIso.replace(/[-:]/g, '').split('.')[0] + 'Z';
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtStart}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${intent.title}`);
    if (intent.description) lines.push(`DESCRIPTION:${intent.description}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const outDir = '/workspace/calendar_exports';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `events_${Date.now()}.ics`);
  fs.writeFileSync(file, lines.join('\n'), 'utf-8');
  return file;
}

export async function createCalendarEvents(intents: ExtractedIntent[]) {
  const result = await createGoogleEvents(intents);
  if (result.reason) {
    const ics = writeIcsFallback(intents);
    return { ...result, ics };
  }
  return result;
}