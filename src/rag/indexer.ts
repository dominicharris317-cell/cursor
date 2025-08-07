import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { config } from '../config';

async function walkFiles(dir: string, exts = ['.txt', '.md']): Promise<string[]> {
  const out: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) {
      out.push(...await walkFiles(p, exts));
    } else if (exts.includes(path.extname(item.name).toLowerCase())) {
      out.push(p);
    }
  }
  return out;
}

export async function buildEmbeddings() {
  if (!fs.existsSync(config.knowledgeDir)) {
    fs.mkdirSync(config.knowledgeDir, { recursive: true });
  }
  const openai = new OpenAI({ apiKey: config.openAiApiKey });
  const files = await walkFiles(config.knowledgeDir);
  const entries: any[] = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf-8').slice(0, 4000);
    const emb = await openai.embeddings.create({ input: text, model: 'text-embedding-3-small' });
    const embedding = emb.data[0]?.embedding || [];
    entries.push({ id: file, filePath: file, text, embedding });
  }
  if (!fs.existsSync(path.dirname(config.embeddingsPath))) {
    fs.mkdirSync(path.dirname(config.embeddingsPath), { recursive: true });
  }
  fs.writeFileSync(config.embeddingsPath, JSON.stringify(entries, null, 2), 'utf-8');
  console.log(`Wrote ${entries.length} embeddings to ${config.embeddingsPath}`);
}

if (require.main === module) {
  buildEmbeddings().catch(err => {
    console.error(err);
    process.exit(1);
  });
}