import express from 'express';
import bodyParser from 'body-parser';
import { config, ensureDirectories } from './config';
import { twimlGatherSay, twimlSayHangup } from './utils/twilio';
import { appendTurn, getOrCreateSession, markDone, saveTranscript } from './store/sessionStore';
import { createCalendarEvents } from './integrations/calendar';
import { createTodoistTasks } from './integrations/todo';
import { extractIntents, generateAssistantTurn } from './ai';

ensureDirectories();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/twilio/voice/answer', async (req, res) => {
  const from = req.body.From || 'unknown';
  const callSid = req.body.CallSid || `sid_${Date.now()}`;
  getOrCreateSession(callSid, from);
  const greet = `Hi, you've reached the voicemail assistant. I'm here to help. What can I take care of for you today?`;
  const twiml = twimlGatherSay(greet, `${config.baseUrl}/twilio/voice/continue`);
  res.type('text/xml').send(twiml);
});

app.post('/twilio/voice/continue', async (req, res) => {
  const from = req.body.From || 'unknown';
  const callSid = req.body.CallSid || `sid_${Date.now()}`;
  const speech = req.body.SpeechResult || req.body.RecordingTranscript || '';
  const session = getOrCreateSession(callSid, from);
  if (speech) appendTurn(session, 'user', speech);

  try {
    const ai = await generateAssistantTurn(session.conversation);
    appendTurn(session, 'assistant', ai.reply);

    if (ai.shouldEnd || (req.body.Digits === '#')) {
      const intents = await extractIntents(session.conversation);
      const calRes = await createCalendarEvents(intents);
      const todoRes = await createTodoistTasks(intents);
      markDone(session);
      const transcriptPath = saveTranscript(session);
      const closing = `Thanks. I've taken note. A summary has been saved. Goodbye!`;
      console.log({ calRes, todoRes, transcriptPath });
      const twiml = twimlSayHangup(closing);
      res.type('text/xml').send(twiml);
    } else {
      const twiml = twimlGatherSay(ai.reply, `${config.baseUrl}/twilio/voice/continue`);
      res.type('text/xml').send(twiml);
    }
  } catch (e) {
    const twiml = twimlSayHangup('Sorry, there was a problem. Goodbye.');
    res.type('text/xml').send(twiml);
  }
});

const port = config.port;
app.listen(port, () => {
  console.log(`Server listening on :${port}`);
});