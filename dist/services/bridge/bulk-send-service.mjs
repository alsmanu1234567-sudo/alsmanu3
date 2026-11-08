// dist/services/bridge/bulk-send-service.mjs
// Phase 9: Service Layer Extraction
// SRP: إرسال رسائل واتساب جماعية مع إحصائيات
// Extracted from: state-switch-handler.mjs (awaiting_custom_list_msg, awaiting_delayed_bulk_msg)
// لا تعتمد على dist/index.mjs — جميع الاعتماديات تُمرَّر كمعاملات

/**
 * إرسال نص لقائمة جهات اتصال واتساب مع خيار التأخير الذكي
 * @param {object} sock - Baileys socket
 * @param {Array<{number: string}>} list - قائمة جهات الاتصال
 * @param {string} text - نص الرسالة
 * @param {boolean} isDelayed - هل يُضاف تأخير عشوائي (2-5 ثوانٍ)؟
 * @returns {{ sent: number, failed: number }}
 */
export async function bulkSendMessages(sock, list, text, isDelayed = false) {
  let sent = 0, failed = 0;
  for (const contact of list) {
    try {
      const jid = `${contact.number}@s.whatsapp.net`;
      await sock.sendMessage?.(jid, { text });
      sent++;
      const delay = isDelayed ? 2000 + Math.floor(Math.random() * 3000) : 500;
      await new Promise(r => setTimeout(r, delay));
    } catch { failed++; }
  }
  return { sent, failed };
}

/**
 * تحديث إحصائيات الإرسال الجماعي في بيانات المستخدم
 * @param {string} userId - معرّف المستخدم
 * @param {number} sent - عدد الرسائل الناجحة
 * @param {number} failed - عدد الرسائل الفاشلة
 * @param {number} total - العدد الإجمالي
 * @param {Function} getUser - دالة جلب بيانات المستخدم
 * @param {Function} saveUser - دالة حفظ بيانات المستخدم
 */
export function updateBulkStats(userId, sent, failed, total, getUser, saveUser) {
  const user = getUser(userId);
  saveUser(userId, {
    bulkStats: {
      sent:   (user.bulkStats?.sent   || 0) + sent,
      failed: (user.bulkStats?.failed || 0) + failed,
      total:  (user.bulkStats?.total  || 0) + total,
    },
  });
}
