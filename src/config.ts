import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  knowledgeDir: process.env.KNOWLEDGE_DIR || '/workspace/knowledge',
  embeddingsPath: process.env.EMBEDDINGS_PATH || '/workspace/data/embeddings.json',
  transcriptsDir: process.env.TRANSCRIPTS_DIR || '/workspace/transcripts',
  twilio: {
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
  },
  todoist: {
    apiToken: process.env.TODOIST_API_TOKEN || '',
  },
  google: {
    calendarDisabled: process.env.GOOGLE_CALENDAR_DISABLED === '1' || process.env.GOOGLE_CALENDAR_DISABLED === 'true',
    credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH || '',
    tokenPath: process.env.GOOGLE_TOKEN_PATH || '',
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
  },
};

export function ensureDirectories() {
  const fs = require('fs');
  const dirs = [config.knowledgeDir, config.transcriptsDir, '/workspace/data'];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}