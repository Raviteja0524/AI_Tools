import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/logos');
mkdirSync(OUT, { recursive: true });

const LOGOS: Record<string, { letter: string; bg: string; fg?: string }> = {
  'chatgpt.svg':          { letter: 'G', bg: '#10A37F' },
  'claude.svg':           { letter: 'C', bg: '#CC785C' },
  'gemini.svg':           { letter: 'G', bg: '#4285F4' },
  'copilot.svg':          { letter: 'C', bg: '#0078D4' },
  'perplexity.svg':       { letter: 'P', bg: '#1FB8CD' },
  'grammarly.svg':        { letter: 'G', bg: '#15C39A' },
  'github-copilot.svg':   { letter: 'G', bg: '#24292E' },
  'cursor.svg':           { letter: 'C', bg: '#000000' },
  'codeium.svg':          { letter: 'C', bg: '#09B585' },
  'ollama.svg':           { letter: 'O', bg: '#1C1C1E' },
  'lm-studio.svg':        { letter: 'L', bg: '#8B5CF6' },
  'notebooklm.svg':       { letter: 'N', bg: '#4285F4' },
  'midjourney.svg':       { letter: 'M', bg: '#000000' },
  'stable-diffusion.svg': { letter: 'S', bg: '#CF4500' },
  'canva.svg':            { letter: 'C', bg: '#00C4CC' },
  'elevenlabs.svg':       { letter: 'E', bg: '#1A1A1A' },
  'murf.svg':             { letter: 'M', bg: '#6366F1' },
  'whisper.svg':          { letter: 'W', bg: '#10A37F' },
  'chatpdf.svg':          { letter: 'C', bg: '#FF5733' },
  'rytr.svg':             { letter: 'R', bg: '#5B4EF5' },
  'suno.svg':             { letter: 'S', bg: '#1A1A1A' },
  'gpt4all.svg':          { letter: 'G', bg: '#412991' },
  'aider.svg':            { letter: 'A', bg: '#2D3748' },
  'notion.svg':           { letter: 'N', bg: '#1A1A1A' },
  'runway.svg':           { letter: 'R', bg: '#1A1A1A' },
  'adobe-firefly.svg':    { letter: 'A', bg: '#FF0000' },
  'jasper.svg':           { letter: 'J', bg: '#FF7A59' },
  'jan.svg':              { letter: 'J', bg: '#5C6BC0' },
  'anythingllm.svg':      { letter: 'A', bg: '#5C2D91' },
  'consensus.svg':        { letter: 'C', bg: '#2563EB' },
  'tabnine.svg':          { letter: 'T', bg: '#7B61FF' },
  'codewhisperer.svg':    { letter: 'Q', bg: '#FF9900', fg: '#000000' },
  'continue.svg':         { letter: 'C', bg: '#1C1C1E' },
  'leonardo.svg':         { letter: 'L', bg: '#FF6B35' },
  'kling.svg':            { letter: 'K', bg: '#1A1A1A' },
  'replit.svg':           { letter: 'R', bg: '#F26207' },
  'huggingface.svg':      { letter: 'H', bg: '#FFD21E', fg: '#1A1A1A' },
};

function makeSvg(letter: string, bg: string, fg = '#FFFFFF'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <rect width="40" height="40" rx="8" fill="${bg}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui,-apple-system,sans-serif"
    font-size="18" font-weight="700" fill="${fg}">${letter}</text>
</svg>`;
}

for (const [filename, { letter, bg, fg }] of Object.entries(LOGOS)) {
  writeFileSync(resolve(OUT, filename), makeSvg(letter, bg, fg));
}

console.log(`✅  Generated ${Object.keys(LOGOS).length} logos in public/logos/`);
