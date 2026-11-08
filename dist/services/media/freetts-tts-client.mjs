// dist/services/media/freetts-tts-client.mjs
// عميل تحويل نص→صوت عبر FreeTTS.org (API عام موثّق بدون مفتاح، حد 20 طلب/دقيقة لكل IP).
// المسؤولية الوحيدة: بناء الصوت وتنزيله كـ Buffer (mp3).

const BASE_URL = 'https://freetts.org';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// خريطة الأصوات بالأكواد — يستخدمها المستخدم بكتابة رقم قبل النص في أمر /صوت
// مثال: /صوت 2 مرحبا  → يستخدم الصوت السعودي الذكر
export const VOICES = {
  '1': 'ar-SA-ZariyahNeural',   // ♀ سعودية (افتراضي)
  '2': 'ar-SA-HamedNeural',     // ♂ سعودي
  '3': 'ar-EG-SalmaNeural',     // ♀ مصرية
  '4': 'ar-EG-ShakirNeural',    // ♂ مصري
  '5': 'ar-AE-FatimaNeural',    // ♀ إماراتية
  '6': 'ar-AE-HamdanNeural',    // ♂ إماراتي
  '7': 'en-US-JennyNeural',     // ♀ إنجليزية أمريكية
  '8': 'en-US-GuyNeural',       // ♂ إنجليزي أمريكي
  '9': 'fr-FR-DeniseNeural',    // ♀ فرنسية
};

// أصوات افتراضية لكل لغة (للتوافق مع الكود القديم)
export const DEFAULT_VOICES = {
  ar: 'ar-SA-ZariyahNeural',
  en: 'en-US-JennyNeural',
  fr: 'fr-FR-DeniseNeural',
};

function pickVoice(lang) {
  const key = String(lang || 'ar').slice(0, 2).toLowerCase();
  return DEFAULT_VOICES[key] || DEFAULT_VOICES.ar;
}

/**
 * يحوّل نصاً إلى صوت mp3 (Buffer) عبر FreeTTS.org.
 * @param {string} text
 * @param {{ voice?: string, lang?: string, rate?: string, pitch?: string }} opts
 * @returns {Promise<{ ok: true, buffer: Buffer, voice: string } | { ok: false, error: string }>}
 */
export async function textToSpeech(text, opts = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return { ok: false, error: 'النص فارغ' };

  const voice = opts.voice || pickVoice(opts.lang);
  const rate = opts.rate || '+0%';
  const pitch = opts.pitch || '+0Hz';

  const COMMON_HEADERS = {
    'User-Agent': BROWSER_UA,
    'Referer': `${BASE_URL}/`,
    'Origin': BASE_URL,
  };

  try {
    const genRes = await fetch(`${BASE_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...COMMON_HEADERS },
      body: JSON.stringify({ text: trimmed, voice, rate, pitch }),
    });
    if (!genRes.ok) {
      return { ok: false, error: `فشل توليد الصوت (HTTP ${genRes.status})` };
    }
    const genJson = await genRes.json().catch(() => null);
    const fileId = genJson?.file_id;
    if (!fileId) return { ok: false, error: 'لم يصل file_id من الخدمة' };

    const audioRes = await fetch(`${BASE_URL}/api/audio/${encodeURIComponent(fileId)}`, {
      headers: { ...COMMON_HEADERS },
    });
    if (!audioRes.ok) {
      return { ok: false, error: `فشل تنزيل الصوت (HTTP ${audioRes.status})` };
    }
    const arrayBuf = await audioRes.arrayBuffer();
    return { ok: true, buffer: Buffer.from(arrayBuf), voice };
  } catch (e) {
    return { ok: false, error: `خطأ شبكة: ${String(e?.message || e)}` };
  }
}
