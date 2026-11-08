// dist/handlers/media-handler.mjs
// Phase 7: Media Handler — مُستخرَج من dist/index.mjs
// [PATCH_PHASE7_MEDIA_EXTRACTED]
// [PATCH_MEDIA_UPLOAD_V2] — دعم رفع الوسائط مباشرة لقسم الردود التلقائية
//
// الواجهة:
//   setDeps({ _getState, _getStatus, replyTargetKeyboard, cancelKeyboard }) — DI
//   handleMedia(bot, msg) → true إذا عولجت الرسالة، false إذا لا

import { mkdir, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

let _deps = {};

export function setDeps(d) {
  _deps = { ..._deps, ...d };
}

export async function handleMedia(bot2, msg2) {
  const { _getState, _getStatus } = _deps;
  const _uid = String(msg2.from?.id);
  const stateModule = await Promise.resolve().then(_getState);
  const getState = stateModule.getState;
  const setState = stateModule.setState;
  const _st = getState(_uid);

  // ── حالة رفع صورة/فيديو للحالة (Status) ────────────────────────────────
  if (_st.state === "awaiting_status_image" || _st.state === "awaiting_status_video") {
    const { handleStatusMedia: _hsm } = await Promise.resolve().then(_getStatus);
    await _hsm(bot2, msg2.chat.id, _uid, msg2, _st);
    return true;
  }

  // ── رفع وسائط للرد التلقائي ──────────────────────────────────────────────
  if (_st.state === "awaiting_reply_media") {
    await _handleAutoReplyMedia(bot2, msg2, _uid, _st, setState);
    return true;
  }

  return false;
}

/**
 * يستقبل صورة / فيديو / ملف / صوت من تيليجرام،
 * يحفظها محلياً ثم ينتقل لاختيار هدف الرد.
 */
async function _handleAutoReplyMedia(bot2, msg2, userId, state, setState) {
  const chatId = msg2.chat.id;
  const replyType = state.data?.replyType;
  const { replyTargetKeyboard, cancelKeyboard } = _deps;
  const cancelKb = (cancelKeyboard && typeof cancelKeyboard === 'function') ? cancelKeyboard() : {};

  // ── استخراج file_id ومعرفة الامتداد ─────────────────────────────────────
  let fileId = null;
  let ext = 'bin';

  if (replyType === 'image' && msg2.photo && msg2.photo.length > 0) {
    const photo = msg2.photo[msg2.photo.length - 1]; // الدقة الأعلى
    fileId = photo.file_id;
    ext = 'jpg';
  } else if (replyType === 'video' && msg2.video) {
    fileId = msg2.video.file_id;
    ext = 'mp4';
  } else if (replyType === 'document' && msg2.document) {
    fileId = msg2.document.file_id;
    const origExt = extname(msg2.document.file_name || '').replace('.', '');
    ext = origExt || 'bin';
  } else if (replyType === 'audio' && (msg2.audio || msg2.voice)) {
    const isVoice = !!msg2.voice;
    const src = msg2.audio || msg2.voice;
    fileId = src.file_id;
    ext = isVoice ? 'ogg' : 'mp3';
    // تخزين نوع MIME الحقيقي في state.data لاستخدامه عند الإرسال
    state.data._audioMime = isVoice ? 'audio/ogg; codecs=opus' : 'audio/mpeg';
  }

  // حد حجم الملف: 20 MB لتفادي استهلاك ذاكرة كبير
  const MAX_SIZE_BYTES = 20 * 1024 * 1024;
  const fileSize = msg2.document?.file_size
    || msg2.video?.file_size
    || (msg2.photo?.[msg2.photo.length - 1]?.file_size)
    || msg2.audio?.file_size
    || msg2.voice?.file_size
    || 0;
  if (fileSize > MAX_SIZE_BYTES) {
    await bot2.sendMessage(
      chatId,
      `❌ حجم الملف (${(fileSize / (1024 * 1024)).toFixed(1)} MB) يتجاوز الحد المسموح (20 MB).\nاستخدم ملفاً أصغر.`,
      { reply_markup: cancelKb }
    );
    return;
  }

  // لم يُرسَل النوع المطلوب
  if (!fileId) {
    const typeLabels = {
      image: 'صورة (ليس ملفاً)',
      video: 'فيديو',
      document: 'ملف',
      audio: 'ملف صوتي أو مقطع صوتي',
    };
    await bot2.sendMessage(
      chatId,
      `❌ يرجى إرسال ${typeLabels[replyType] || 'الوسائط المطلوبة'} مباشرة في الشات.`,
      { reply_markup: cancelKb }
    );
    return;
  }

  try {
    // ── تنزيل الملف من تيليجرام ──────────────────────────────────────────
    const fileLink = await bot2.getFileLink(fileId);
    const response = await fetch(fileLink, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`فشل التنزيل: HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    // ── حفظ الملف محلياً ─────────────────────────────────────────────────
    const dir = `data/auto-reply-media/${userId}`;
    await mkdir(dir, { recursive: true });
    const filename = `${Date.now()}.${ext}`;
    const localPath = `${dir}/${filename}`;
    await writeFile(localPath, buffer);

    // ── تحديث الحالة ─────────────────────────────────────────────────────
    // setState يدمج البيانات مع الموجودة (trigger, triggerType, إلخ)
    setState(userId, "awaiting_reply_target", { replyContent: `local:${localPath}` });

    const typeLabels = {
      image: '🖼️ صورة',
      video: '🎬 فيديو',
      document: '📄 ملف',
      audio: '🎵 صوت',
    };
    const sizeKb = (buffer.length / 1024).toFixed(1);
    const targetKb = (replyTargetKeyboard && typeof replyTargetKeyboard === 'function')
      ? replyTargetKeyboard()
      : {};

    await bot2.sendMessage(
      chatId,
      `✅ *تم استلام ${typeLabels[replyType] || 'الملف'}* (${sizeKb} KB)\n\n*الخطوة التالية:* اختر من يستلم هذا الرد:`,
      { parse_mode: "Markdown", reply_markup: targetKb }
    );
  } catch (err) {
    console.error('[media-handler] خطأ في رفع وسائط الرد التلقائي:', String(err));
    await bot2.sendMessage(
      chatId,
      `❌ فشل في حفظ الملف: ${err.message || 'خطأ غير معروف'}\n\nحاول مرة أخرى أو اضغط إلغاء.`,
      { reply_markup: cancelKb }
    );
  }
}
