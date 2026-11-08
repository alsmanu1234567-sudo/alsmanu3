// dist/services/points/bulk-points-service.mjs
// Phase 9: Service Layer Extraction
// SRP: توزيع نقاط جماعي على مجموعة من المستخدمين
// Extracted from: developer-handler.mjs (awaiting_bulk_points_message)
// لا تعتمد على dist/index.mjs — جميع الاعتماديات تُمرَّر كمعاملات

/**
 * توزيع نقاط على مجموعة مستخدمين (مع إمكانية التصفية بالفئة)
 * @param {Array} allUsers - قائمة المستخدمين
 * @param {number} amount - كمية النقاط لكل مستخدم
 * @param {string} reason - سبب المنح
 * @param {string|null} tier - الفئة المستهدفة (null = الكل)
 * @param {Function} addPoints - دالة إضافة النقاط
 * @returns {{ count: number }} عدد المستخدمين الذين تلقوا النقاط
 */
export async function distributeBulkPoints(allUsers, amount, reason, tier, addPoints) {
  const filtered = tier ? allUsers.filter(u => u.tier === tier) : allUsers;
  let count = 0;
  for (const u of filtered) {
    try {
      addPoints(String(u.telegramId), amount, reason || 'من المطوّر');
      count++;
    } catch {}
  }
  return { count };
}
