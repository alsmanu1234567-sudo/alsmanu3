// dist/services/media/freetts-stt-client.mjs
// عميل تحويل صوت→نص عبر FreeTTS.org (نفس الـ endpoint الذي تستخدمه واجهتهم — استخدام مجهول
// عادي بدون أي انتحال هوية أو تدوير IP/عناوين، بحدود الاستخدام المجانية العادية).
// المسؤولية الوحيدة: رفع الصوت واستخراج النص المكتوب.

const BASE_URL = 'https://freetts.org';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function guessExt(mimetype) {
  const m = String(mimetype || '').toLowerCase();
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mp4') || m.includes('m4a')) return 'mp4';
  if (m.includes('mp3') || m.includes('mpeg')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  return 'webm';
}

/**
 * يحوّل صوتاً (Buffer) إلى نص عبر FreeTTS.org مع كشف اللغة تلقائياً.
 * @param {Buffer} audioBuffer
 * @param {{ mimetype?: string, language?: string }} opts
 * @returns {Promise<{ ok: true, text: string, segments: any[] } | { ok: false, error: string }>}
 */
export async function speechToText(audioBuffer, opts = {}) {
  if (!audioBuffer || !audioBuffer.length) {
    return { ok: false, error: 'لا يوجد صوت لتحويله' };
  }

  const ext = guessExt(opts.mimetype);
  const language = opts.language || 'auto';

  try {
    const form = new FormData();
    const blob = new Blob([audioBuffer], { type: opts.mimetype || `audio/${ext}` });
    form.append('audio', blob, `capture.${ext}`);
    form.append('language', language);
    form.append('diarization', 'false');
    form.append('durationSec', '0');

    const headers = {
      'User-Agent': BROWSER_UA,
      'Referer': `${BASE_URL}/`,
      'Origin': BASE_URL,
    };
    let res = await fetch(`${BASE_URL}/api/speech-to-text`, { method: 'POST', headers, body: form });
    if (!res.ok && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1200));
      res = await fetch(`${BASE_URL}/api/speech-to-text`, { method: 'POST', headers, body: form });
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const msg = errJson?.error || errJson?.detail?.error || `HTTP ${res.status}`;
      return { ok: false, error: `فشل تحويل الصوت لنص: ${msg}` };
    }

    const json = await res.json();
    const text = String(json?.transcript || '').trim();
    if (!text) return { ok: false, error: 'لم يتم التعرف على أي كلام في الرسالة الصوتية' };

    return { ok: true, text, segments: Array.isArray(json?.segments) ? json.segments : [] };
  } catch (e) {
    return { ok: false, error: `خطأ شبكة: ${String(e?.message || e)}` };
  }
}
