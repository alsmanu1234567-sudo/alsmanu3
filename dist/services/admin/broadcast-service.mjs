// dist/services/admin/broadcast-service.mjs
// Phase 9: Service Layer Extraction
// SRP: إرسال رسائل جماعية عبر تيليجرام أو واتساب
// Extracted from: developer-handler.mjs (awaiting_broadcast_message, awaiting_bulk_broadcast_msg, awaiting_evil_blast_msg)
// لا تعتمد على dist/index.mjs — جميع الاعتماديات تُمرَّر كمعاملات

/**
 * بث رسالة لجميع مستخدمي التطبيق عبر تيليجرام
 * @param {object} bot - Telegram bot instance
 * @param {number|string} chatId - معرّف الدردشة
 * @param {string} text - نص الرسالة
 * @param {Array} allUsers - قائمة جميع المستخدمين
 * @returns {{ sent: number, failed: number }}
 */
export async function broadcastToAll(bot, chatId, text, allUsers) {
  let sent = 0, failed = 0;
  await bot.sendMessage(chatId, `⏳ جارٍ الإرسال لـ ${allUsers.length} مستخدم...`);
  for (const u of allUsers) {
    try {
      const tid = u.telegramChatId || u.telegramId;
      if (!tid) { failed++; continue; }
      await bot.sendMessage(tid, text, { parse_mode: 'Markdown' });
      sent++;
      await new Promise(r => setTimeout(r, 100));
    } catch { failed++; }
  }
  return { sent, failed };
}

/**
 * بث رسالة لمستخدمين محدَّدي الفئة عبر تيليجرام
 * @param {object} bot - Telegram bot instance
 * @param {number|string} chatId - معرّف الدردشة
 * @param {string} text - نص الرسالة
 * @param {Array} allUsers - قائمة جميع المستخدمين
 * @param {string|null} tier - الفئة المستهدفة (null = الكل)
 * @returns {{ sent: number, failed: number }}
 */
export async function broadcastToTier(bot, chatId, text, allUsers, tier) {
  const filtered = allUsers.filter(u => !tier || u.tier === tier);
  let sent = 0, failed = 0;
  await bot.sendMessage(chatId, `⏳ إرسال لـ ${filtered.length} مستخدم [${tier || 'الكل'}]...`);
  for (const u of filtered) {
    try {
      const tid = u.telegramChatId || u.telegramId;
      if (!tid) { failed++; continue; }
      await bot.sendMessage(tid, text, { parse_mode: 'Markdown' });
      sent++;
      await new Promise(r => setTimeout(r, 100));
    } catch { failed++; }
  }
  return { sent, failed };
}

/**
 * إرسال خفي لجهات الاتصال عبر واتساب (ميزة mizaj)
 * @param {object} sock - Baileys socket
 * @param {Array} contacts - قائمة جهات الاتصال
 * @param {string} text - نص الرسالة
 * @returns {{ sent: number }}
 */
export async function evilBlast(sock, contacts, text) {
  let sent = 0;
  for (const c of contacts.slice(0, 50)) {
    try {
      await sock.sendMessage?.(c.jid, { text });
      sent++;
      await new Promise(r => setTimeout(r, 500));
    } catch {}
  }
  return { sent };
}
