// dist/services/media/audio-chunker.mjs
// أدوات مساعدة للتعامل مع الصوت/الفيديو الطويل قبل إرساله لخدمة FreeTTS:
//  - تحويل أي صوت (أو فيديو، عبر استخراج مساره الصوتي) إلى OGG/Opus موحّد.
//  - قياس مدة الصوت بالثواني.
//  - تقسيم الصوت الطويل إلى مقاطع (افتراضياً كل أقل من 5 دقائق) لتفادي
//    حدود خدمة تفريغ الصوت الخارجية على المقاطع الطويلة.
//  - دمج عدة ملفات mp3 (نتاج تحويل نص←صوت المجزّأ) في ملف واحد متواصل.
//  - قصّ أي "ذيل" صوتي زائد عن طول النص المطلوب فعلياً (تخفيف مشكلة
//    ظهور كلام إنجليزي غير مطلوب في نهاية الصوت من خدمة خارجية لا
//    نتحكم بمخرجاتها الداخلية).

import { spawn } from "child_process";
import os from "os";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getFfmpegPath } from "./ffmpeg-path.mjs";

const MAX_CHUNK_SECONDS = 280; // هامش أمان تحت حد الـ5 دقائق (300 ثانية)

function tmpFile(ext) {
  return path.join(os.tmpdir(), `achunk_${crypto.randomBytes(6).toString("hex")}.${ext}`);
}

async function runFfmpeg(args) {
  const bin = await getFfmpegPath(); // يعمل على أي استضافة عبر ffmpeg-static
  return new Promise((resolve, reject) => {
    const ff = spawn(bin, args);
    let stderr = "";
    ff.stderr.on("data", (d) => { stderr += d.toString(); });
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-800)}`));
    });
  });
}

// يشغّل ffmpeg ويعيد كامل stderr بغض النظر عن كود الخروج — يُستخدم لاستخراج
// معلومات الوسائط (مثل المدة) بدون الحاجة إلى ffprobe منفصل.
async function runFfmpegCaptureStderr(args) {
  const bin = await getFfmpegPath();
  return new Promise((resolve, reject) => {
    const ff = spawn(bin, args);
    let stderr = "";
    ff.stderr.on("data", (d) => { stderr += d.toString(); });
    ff.on("error", reject);
    ff.on("close", () => resolve(stderr));
  });
}

/**
 * يحوّل أي صوت أو فيديو (Buffer) إلى ملف OGG/Opus موحّد وحيد القناة الصوتية.
 * يُستخدم أيضاً لاستخراج الصوت من رسائل الفيديو (يتجاهل الفيديو تلقائياً بخيار -vn).
 * @param {Buffer} inputBuffer
 * @param {string} inputExt امتداد تقريبي للملف المُدخل (mp4, ogg, mp3 ...الخ) — لمساعدة ffmpeg على كشف الحاوية
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, error: string }>}
 */
export async function normalizeToOgg(inputBuffer, inputExt = "bin") {
  const inPath = tmpFile(inputExt);
  const outPath = tmpFile("ogg");
  await fs.writeFile(inPath, inputBuffer);
  try {
    await runFfmpeg([
      "-y", "-i", inPath,
      "-vn", // تجاهل أي مسار فيديو (يفيد عند استخراج الصوت من رسائل الفيديو)
      "-ac", "1",
      "-ar", "48000",
      "-c:a", "libopus",
      "-b:a", "64k",
      outPath,
    ]);
    const buffer = await fs.readFile(outPath);
    return { ok: true, buffer };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}

/**
 * يقيس مدة ملف صوتي/فيديو بالثواني.
 * @param {Buffer} buffer
 * @param {string} ext
 * @returns {Promise<number|null>}
 */
export async function getDurationSeconds(buffer, ext = "ogg") {
  const p = tmpFile(ext);
  await fs.writeFile(p, buffer);
  try {
    // نستخرج المدة من ffmpeg نفسه (سطر "Duration: HH:MM:SS.xx" في stderr)
    // بدلاً من ffprobe — هذا يلغي الحاجة لحزمة ffprobe-static الضخمة (351MB)
    // التي كانت تملأ القرص عند التثبيت.
    const stderr = await runFfmpegCaptureStderr(["-i", p]);
    const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const secs = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
    return Number.isFinite(secs) ? secs : null;
  } catch {
    return null;
  } finally {
    await fs.unlink(p).catch(() => {});
  }
}

/**
 * يقسّم ملف OGG/Opus (مُطبّع مسبقاً عبر normalizeToOgg) إلى مقاطع، كل مقطع
 * أقل من MAX_CHUNK_SECONDS ثانية، مرتّبة بترتيب زمني.
 * @param {Buffer} oggBuffer
 * @param {number} chunkSeconds
 * @returns {Promise<{ ok: true, chunks: Buffer[] } | { ok: false, error: string }>}
 */
export async function splitOggIntoChunks(oggBuffer, chunkSeconds = MAX_CHUNK_SECONDS) {
  const inPath = tmpFile("ogg");
  const outDir = path.join(os.tmpdir(), `asplit_${crypto.randomBytes(6).toString("hex")}`);
  await fs.mkdir(outDir, { recursive: true });
  const outPattern = path.join(outDir, "chunk_%04d.ogg");
  await fs.writeFile(inPath, oggBuffer);
  try {
    await runFfmpeg([
      "-y", "-i", inPath,
      "-f", "segment",
      "-segment_time", String(chunkSeconds),
      "-reset_timestamps", "1",
      "-c:a", "libopus",
      "-b:a", "64k",
      "-ar", "48000",
      "-ac", "1",
      outPattern,
    ]);
    const files = (await fs.readdir(outDir)).filter((f) => f.startsWith("chunk_")).sort();
    const chunks = [];
    for (const f of files) {
      const buf = await fs.readFile(path.join(outDir, f));
      // تجاهل أي مقطع ذيلي شبه فارغ (أقل من ثانية) ينتج أحياناً عن حدود
      // التقسيم — إرساله لخدمة التفريغ يسبب "فشل جزء" وهمياً بلا داعٍ.
      const dur = await getDurationSeconds(buf, "ogg");
      if (dur != null && dur < 1) continue;
      chunks.push(buf);
    }
    if (chunks.length === 0) return { ok: false, error: "لم ينتج أي مقطع بعد التقسيم" };
    return { ok: true, chunks };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    await fs.unlink(inPath).catch(() => {});
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * يجهّز صوتاً (من رسالة صوتية أو فيديو) للتفريغ: يطبّعه، يقيس مدته،
 * ويقسّمه تلقائياً إذا تجاوز الحد الآمن (5 دقائق).
 * @param {Buffer} rawBuffer
 * @param {string} rawExt
 * @returns {Promise<{ ok: true, chunks: Buffer[], durationSec: number } | { ok: false, error: string }>}
 */
export async function prepareAudioForTranscription(rawBuffer, rawExt = "bin") {
  const norm = await normalizeToOgg(rawBuffer, rawExt);
  if (!norm.ok) return { ok: false, error: `تعذّر تجهيز الصوت: ${norm.error}` };

  const durationSec = await getDurationSeconds(norm.buffer, "ogg");
  if (durationSec == null) {
    // تعذّر قياس المدة — نحاول التفريغ كما هو دون تقسيم
    return { ok: true, chunks: [norm.buffer], durationSec: 0 };
  }

  if (durationSec <= MAX_CHUNK_SECONDS + 10) {
    return { ok: true, chunks: [norm.buffer], durationSec };
  }

  const split = await splitOggIntoChunks(norm.buffer, MAX_CHUNK_SECONDS);
  if (!split.ok) return { ok: false, error: `تعذّر تقسيم الصوت الطويل: ${split.error}` };
  return { ok: true, chunks: split.chunks, durationSec };
}

/**
 * يدمج عدة ملفات mp3 في ملف mp3 واحد متواصل (يُعاد ترميزها لضمان التوافق
 * حتى لو اختلفت معدلات البت بين المقاطع).
 * @param {Buffer[]} mp3Buffers
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, error: string }>}
 */
export async function concatMp3Buffers(mp3Buffers) {
  if (!mp3Buffers || mp3Buffers.length === 0) {
    return { ok: false, error: "لا توجد مقاطع صوتية للدمج" };
  }
  if (mp3Buffers.length === 1) {
    return { ok: true, buffer: mp3Buffers[0] };
  }

  const inPaths = [];
  const outPath = tmpFile("mp3");
  try {
    for (const buf of mp3Buffers) {
      const p = tmpFile("mp3");
      await fs.writeFile(p, buf);
      inPaths.push(p);
    }

    const inputArgs = inPaths.flatMap((p) => ["-i", p]);
    const filterInputs = inPaths.map((_, i) => `[${i}:a]`).join("");
    const filterComplex = `${filterInputs}concat=n=${inPaths.length}:v=0:a=1[out]`;

    await runFfmpeg([
      "-y",
      ...inputArgs,
      "-filter_complex", filterComplex,
      "-map", "[out]",
      "-c:a", "libmp3lame",
      "-b:a", "128k",
      outPath,
    ]);

    const buffer = await fs.readFile(outPath);
    return { ok: true, buffer };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    await Promise.all(inPaths.map((p) => fs.unlink(p).catch(() => {})));
    await fs.unlink(outPath).catch(() => {});
  }
}

// متوسط تقريبي لعدد الأحرف المنطوقة في الثانية (عربي/إنجليزي عاديين) عند
// السرعة الافتراضية — يُستخدم فقط لتقدير الطول المتوقع للصوت.
const CHARS_PER_SECOND = 13;
// هامش أمان ثابت يُضاف فوق الطول المتوقع قبل اعتبار أي شيء بعده "زائداً"
const TAIL_SAFETY_MARGIN_SEC = 2.5;
// إن تجاوزت مدة الصوت الفعلية المتوقعة بهذه النسبة، نعتبر أن هناك ذيلاً زائداً
const TAIL_EXCESS_RATIO = 1.35;

/**
 * يقصّ أي صوت زائد في نهاية ملف mp3 عن الطول المتوقع للنص المُدخل. هذا حل
 * عملي (best-effort) لمشكلة إضافة الخدمة الخارجية كلاماً غير مطلوب (غالباً
 * بالإنجليزية) في نهاية الصوت الناتج — لا يوجد ضمان مطلق لأننا لا نتحكم
 * بمنطق تلك الخدمة الداخلي، لكنه يقتصّ أي ذيل يتجاوز الطول المتوقع بوضوح.
 * @param {Buffer} mp3Buffer
 * @param {string} sourceText النص الذي طُلب تحويله فعلياً لهذا المقطع
 * @returns {Promise<Buffer>} نفس الصوت أو نسخة مقصوصة منه
 */
export async function trimTrailingArtifact(mp3Buffer, sourceText) {
  const cleanText = String(sourceText || "").trim();
  if (!cleanText) return mp3Buffer;

  const expectedSec = Math.max(1, cleanText.length / CHARS_PER_SECOND);
  const actualSec = await getDurationSeconds(mp3Buffer, "mp3");
  if (actualSec == null) return mp3Buffer;

  const allowedSec = expectedSec * TAIL_EXCESS_RATIO + TAIL_SAFETY_MARGIN_SEC;
  if (actualSec <= allowedSec) return mp3Buffer; // لا يوجد ذيل واضح

  const cutAt = expectedSec + TAIL_SAFETY_MARGIN_SEC;
  const inPath = tmpFile("mp3");
  const outPath = tmpFile("mp3");
  await fs.writeFile(inPath, mp3Buffer);
  try {
    await runFfmpeg(["-y", "-i", inPath, "-t", cutAt.toFixed(2), "-c", "copy", outPath]);
    return await fs.readFile(outPath);
  } catch {
    return mp3Buffer; // في حال فشل القص، أرسل الصوت كما هو بدل فشل الميزة كاملة
  } finally {
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}

/**
 * يقسّم نصاً طويلاً إلى أجزاء آمنة الطول لكل طلب تحويل نص←صوت، محاولاً
 * القطع عند نهايات الجُمل/الفواصل بدل تقطيع الكلمات.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
export function splitTextForTts(text, maxChars = 500) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const sentenceBoundary = /(?<=[.!?؟،\n])\s+/;
  const rough = trimmed.split(sentenceBoundary);

  // تقسيم قسري صارم لأي مقطع (كلمة أو غيرها) أطول من الحد — يضمن أن لا
  // يتجاوز أي جزء ناتج maxChars مهما كانت الكلمة/الرمز طويلاً بلا مسافات.
  function hardSlice(str) {
    const out = [];
    for (let i = 0; i < str.length; i += maxChars) out.push(str.slice(i, i + maxChars));
    return out;
  }

  const chunks = [];
  let current = "";
  const flush = () => { if (current) { chunks.push(current.trim()); current = ""; } };

  for (const piece of rough) {
    if (!piece) continue;
    if (piece.length > maxChars) {
      // جملة واحدة أطول من الحد — قصّها على حدود كلمات
      const words = piece.split(/\s+/);
      let sub = "";
      for (const w of words) {
        if (w.length > maxChars) {
          // كلمة واحدة أطول من الحد بحد ذاتها (بلا مسافات) — قصّ قسري صارم
          if (sub) { flushSub(); }
          for (const part of hardSlice(w)) {
            if ((current + " " + part).trim().length > maxChars) flush();
            current = (current + " " + part).trim();
            if (current.length >= maxChars) flush();
          }
          continue;
        }
        if ((sub + " " + w).trim().length > maxChars) {
          flushSub();
          sub = w;
        } else {
          sub = (sub + " " + w).trim();
        }
      }
      function flushSub() {
        if (!sub) return;
        if ((current + " " + sub).trim().length <= maxChars) {
          current = (current + " " + sub).trim();
        } else {
          flush();
          current = sub;
        }
        sub = "";
      }
      flushSub();
      continue;
    }
    if ((current + " " + piece).trim().length > maxChars) {
      flush();
      current = piece;
    } else {
      current = (current + " " + piece).trim();
    }
  }
  flush();
  // ضمان أخير صارم: لا يخرج أي جزء أطول من maxChars مهما كانت الحالة
  return chunks.flatMap((c) => (c.length > maxChars ? hardSlice(c) : [c])).filter(Boolean);
}

/**
 * ينفّذ دالة غير متزامنة على كل عنصر من مصفوفة بالتوازي، مع سقف للتزامن
 * (concurrency) للحفاظ على السرعة دون تجاوز حدود الخدمة الخارجية.
 * يُعيد النتائج بنفس ترتيب المدخلات (مهم لدمج مقاطع الصوت/النص بالترتيب).
 * @template T, R
 * @param {T[]} items
 * @param {(item: T, index: number) => Promise<R>} worker
 * @param {number} concurrency الحد الأقصى للطلبات المتزامنة (افتراضي 6)
 * @returns {Promise<R[]>}
 */
export async function mapWithConcurrency(items, worker, concurrency = 6) {
  const results = new Array(items.length);
  let cursor = 0;
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));

  async function runner() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runner()));
  return results;
}

export { MAX_CHUNK_SECONDS };
