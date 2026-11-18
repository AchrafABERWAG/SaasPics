import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Resend } from 'resend';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

// Transport :
//   - "resend" : envoi réel (RESEND_API_KEY + EMAIL_FROM avec un domaine vérifié)
//   - "file"   : écrit chaque email dans .outbox/ (développement et tests)
//   - "log"    : affiche l'email dans la console
// Par défaut : resend si configuré, sinon log. EMAIL_TRANSPORT force un mode.
type Transport = 'resend' | 'file' | 'log';

function transport(): Transport {
  const forced = process.env.EMAIL_TRANSPORT;
  if (forced === 'resend' || forced === 'file' || forced === 'log') return forced;
  return process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? 'resend' : 'log';
}

let resendClient: Resend | null = null;

export async function sendEmail(message: EmailMessage): Promise<void> {
  const mode = transport();

  if (mode === 'resend') {
    const from = process.env.EMAIL_FROM;
    if (!process.env.RESEND_API_KEY || !from) throw new Error('RESEND_API_KEY ou EMAIL_FROM manquant.');
    resendClient ??= new Resend(process.env.RESEND_API_KEY);
    const { error } = await resendClient.emails.send({ from, ...message });
    if (error) throw new Error(`Resend: ${error.message}`);
    return;
  }

  if (mode === 'file') {
    const dir = path.join(process.cwd(), '.outbox');
    await mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    await writeFile(path.join(dir, name), JSON.stringify(message, null, 2), 'utf8');
    return;
  }

  console.info(`[email] to=${message.to} subject="${message.subject}"\n${message.text}`);
}
