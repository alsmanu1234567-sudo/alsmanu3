// dist/services/download/download-parser-service.mjs
// Phase 9: Service Layer Extraction
// SRP: تحليل (parse) أوامر التنزيل واستخراج المعاملات منها
// Extracted from: download-handler.mjs (parsing logic inside /vid /song /film /tiktok handlers)
// لا تعتمد على dist/index.mjs — دوال خالصة بلا جانب آثار

/**
 * تحليل أمر /vid: [جودة 1-3] [عدد 1-5] <بحث>
 * @param {string} text - النص الكامل للرسالة
 * @returns {{ quality: number, count: number, query: string, label: string } | null}
 */
export function parseVideoCommand(text) {
  const rest = text.replace('/vid', '').trim();
  if (!rest) return null;
  const parts = rest.split(/\s+/);
  let quality = 2, count = 1, qi = 0;
  if (/^[123]$/.test(parts[0])) { quality = parseInt(parts[0]); qi = 1; }
  if (qi < parts.length && /^\d+$/.test(parts[qi]) && parseInt(parts[qi]) >= 1) {
    count = Math.min(parseInt(parts[qi]), 5);
    qi++;
  }
  const query = parts.slice(qi).join(' ');
  if (!query) return null;
  const label = quality === 1 ? '360p' : quality === 2 ? '480p' : '720p';
  return { quality, count, query, label };
}

/**
 * تحليل أمر /song: [عدد 1-10] <بحث>
 * @param {string} text - النص الكامل للرسالة
 * @returns {{ count: number, query: string } | null}
 */
export function parseAudioCommand(text) {
  const rest = text.replace('/song', '').trim();
  if (!rest) return null;
  const parts = rest.split(/\s+/);
  let count = 1, si = 0;
  if (/^\d+$/.test(parts[0]) && parseInt(parts[0]) >= 1) {
    count = Math.min(parseInt(parts[0]), 10);
    si = 1;
  }
  const query = parts.slice(si).join(' ');
  if (!query) return null;
  return { count, query };
}

/**
 * تحليل أمر /film: [جودة 1-3] <اسم الفيلم>
 * يقبل الجودة في أول الأمر أو آخره
 * @param {string} text - النص الكامل للرسالة
 * @returns {{ query: string, quality: number } | null}
 */
export function parseFilmCommand(text) {
  const rest = text.replace('/film', '').trim();
  if (!rest) return null;
  let query = rest, quality = 2;
  const parts = query.split(' ');
  if (parts.length >= 2) {
    const last  = parts[parts.length - 1];
    const first = parts[0];
    if (last === '1' || last === '2' || last === '3') {
      quality = parseInt(last);
      query = parts.slice(0, -1).join(' ');
    } else if ((first === '1' || first === '2' || first === '3') && parts.length > 1) {
      quality = parseInt(first);
      query = parts.slice(1).join(' ');
    }
  }
  if (!query) return null;
  return { query, quality };
}

/**
 * تحليل أمر /tiktok: [عدد 1-5] <بحث>
 * @param {string} text - النص الكامل للرسالة
 * @returns {{ count: number, query: string } | null}
 */
export function parseTikTokCommand(text) {
  const rest = text.replace('/tiktok', '').trim();
  if (!rest) return null;
  const parts = rest.split(/\s+/);
  let count = 3, ti = 0;
  if (/^\d+$/.test(parts[0]) && parseInt(parts[0]) >= 1) {
    count = Math.min(parseInt(parts[0]), 5);
    ti = 1;
  }
  const query = parts.slice(ti).join(' ');
  if (!query) return null;
  return { count, query };
}

/**
 * تسمية جودة الفيلم (رقم → نص)
 */
export function qualityLabel(quality) {
  const labels = ['', 'منخفضة', 'متوسطة', 'عالية'];
  return labels[quality] || 'متوسطة';
}
