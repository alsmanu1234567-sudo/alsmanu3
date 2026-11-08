// dist/services/calls/blocklist-service.mjs
// Phase 9: Service Layer Extraction
// SRP: إدارة قائمة الأرقام المحظورة من المكالمات لكل مستخدم
// Extracted from: calls-handler.mjs (calls_block_quick_ callback logic)
// لا تعتمد على dist/index.mjs — جميع الاعتماديات تُمرَّر كمعاملات

/**
 * إضافة رقم لقائمة حظر المكالمات
 * @param {object} user - بيانات المستخدم
 * @param {string} callerNum - الرقم المراد حظره
 * @returns {{ blocked: string[], wasAlreadyBlocked: boolean }}
 */
export function blockCaller(user, callerNum) {
  const blocked = [...(user.blockedCallers || [])];
  const wasAlreadyBlocked = blocked.includes(callerNum);
  if (!wasAlreadyBlocked) {
    blocked.push(callerNum);
  }
  return { blocked, wasAlreadyBlocked };
}

/**
 * إزالة رقم من قائمة حظر المكالمات
 * @param {object} user - بيانات المستخدم
 * @param {string} callerNum - الرقم المراد إلغاء حظره
 * @returns {{ blocked: string[] }}
 */
export function unblockCaller(user, callerNum) {
  const blocked = (user.blockedCallers || []).filter(n => n !== callerNum);
  return { blocked };
}

/**
 * فحص ما إذا كان رقم محظوراً
 * @param {object} user - بيانات المستخدم
 * @param {string} callerNum - الرقم المراد فحصه
 * @returns {boolean}
 */
export function isCallerBlocked(user, callerNum) {
  return (user.blockedCallers || []).includes(callerNum);
}

/**
 * جلب قائمة الأرقام المحظورة
 * @param {object} user - بيانات المستخدم
 * @returns {string[]}
 */
export function getBlockedCallers(user) {
  return [...(user.blockedCallers || [])];
}
