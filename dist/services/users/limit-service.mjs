// dist/services/users/limit-service.mjs
// Phase 9: Service Layer Extraction
// SRP: فحص وتتبع حدود الاستخدام اليومية لكل مستخدم
// Extracted from: numbers-handler.mjs (limit check logic)
// لا تعتمد على dist/index.mjs — جميع الاعتماديات تُمرَّر كمعاملات

/**
 * فحص ما إذا كان المستخدم قد وصل لحد الاستخدام اليومي
 * @param {number} count - الاستخدام الحالي
 * @param {number|Infinity} limit - الحد المسموح
 * @returns {{ allowed: boolean, count: number, limit: number|Infinity }}
 */
export function checkDailyLimit(count, limit) {
  return {
    allowed: count < limit,
    count,
    limit,
  };
}

/**
 * تنسيق قيمة الحد للعرض (Infinity → '∞')
 * @param {number|Infinity} limit
 * @returns {string}
 */
export function formatLimit(limit) {
  return limit === Infinity ? '∞' : String(limit);
}

/**
 * توليد نص رسالة الوصول للحد
 * @param {number} count - الاستخدام الحالي
 * @param {number|Infinity} limit - الحد المسموح
 * @returns {string}
 */
export function limitReachedMessage(count, limit) {
  return `❌ وصلت للحد اليومي (${count}/${formatLimit(limit)})`;
}
