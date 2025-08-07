# Cursor

[Cursor](https://cursor.com) is a code editor built for programming with AI.

Creating new posts on [the forum](https://forum.cursor.com/) for bugs or feature requests is much appreciated 🙂 Feel free to react to the ones you'd like us to prioritize.

## Getting Started

Head over to [our website](https://cursor.com/) to download and try out the editor.

## Features

[See here](https://cursor.com/features) for more info on Cursor's features.

## AI Voicemail Assistant

A Node.js TypeScript server that answers calls sent to voicemail, has a short voice conversation via Twilio speech `<Gather>`, summarizes the call, writes a transcript, and turns outcomes into calendar events and Todoist tasks. It also uses a local knowledge folder for better answers.

### Features
- Conversational voicemail via Twilio Programmable Voice
- Conversation transcript saved under `transcripts/`
- Intent extraction to:
  - Create Google Calendar events (or local ICS fallback)
  - Create Todoist tasks
- Simple RAG over `knowledge/` using OpenAI embeddings

### Prereqs
- Node 18+
- Twilio account with a phone number
- OpenAI API key

### Setup
1. Copy `.env.example` to `.env` and fill `OPENAI_API_KEY`. Optionally add Todoist and Google settings.
2. Put reference files in `knowledge/` (txt or md). Run:
   ```bash
   npm run index:knowledge
   ```
3. Start server:
   ```bash
   npm run dev
   ```
4. Expose locally via ngrok:
   ```bash
   npx ngrok http 3000
   ```
   Set `BASE_URL` to the https ngrok URL, restart server.

### Twilio Configuration
- Voice webhook (A CALL COMES IN): `POST` to `${BASE_URL}/twilio/voice/answer`
- The server will drive the `<Gather>` loop and finish with a `<Hangup>`.

### Calendars
- Google Calendar: provide `GOOGLE_CREDENTIALS_PATH` and `GOOGLE_TOKEN_PATH` (OAuth client + token). If not configured, an `ICS` file is written to `calendar_exports/` as a fallback.

### Todoist
- Provide `TODOIST_API_TOKEN` to create tasks.

### Notes
- To end a call early, the user can say "that's all"; the AI also auto-detects wrap-up. You can also press `#` to force wrap.
