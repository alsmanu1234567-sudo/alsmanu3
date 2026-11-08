// dist/services/admin/user-admin-service.mjs
// Phase 9: Service Layer Extraction
// SRP: عمليات إدارة المستخدمين (الفئة، الحذف، التواصل، النقاط) — للمطوّر فقط
// Extracted from: developer-handler.mjs (awaiting_devaction_pts/tier/msg/delete_confirm)
// لا تعتمد على dist/index.mjs — جميع الاعتماديات تُمرَّر كمعاملات

const _VALID_TIERS = ['free', 'pro', 'promax', 'khariq', 'khariqpro', 'mizaj'];
// [FIX-GRANT-FEATURE] الحد الأقصى للأرقام لكل فئة
const _TIER_MAX_NUMS = { free: 1, pro: 10, promax: 20, khariq: 50, khariqpro: 100, mizaj: 999999 };

/**
 * التحقق من صلاحية اسم فئة
 */
export function isValidTier(tier) {
  return _VALID_TIERS.includes(String(tier).trim().toLowerCase());
}

/**
 * قائمة الفئات المتاحة
 */
export function getValidTiers() {
  return [..._VALID_TIERS];
}

/**
 * تغيير فئة المستخدم
 * @param {string} targetId - معرّف المستخدم الهدف
 * @param {string} newTier - الفئة الجديدة
 * @param {Function} saveUser - دالة حفظ بيانات المستخدم
 * @returns {{ ok: boolean, tier: string }}
 */
export function changeTier(targetId, newTier, saveUser) {
  const tier = String(newTier).trim().toLowerCase();
  if (!isValidTier(tier)) return { ok: false, tier };
  // [FIX-GRANT-FEATURE] حفظ maxNumbers مع tier لضمان تفعيل حد الأرقام
  const maxNumbers = _TIER_MAX_NUMS[tier] ?? 1;
  saveUser(targetId, { tier, maxNumbers });
  return { ok: true, tier, maxNumbers };
}

/**
 * حذف مستخدم من قاعدة البيانات (soft removal من المصفوفة)
 * @param {string} targetId - معرّف المستخدم
 * @param {Function} getAllUsers - دالة جلب جميع المستخدمين
 * @returns {{ ok: boolean, reason?: string }}
 */
export function deleteUser(targetId, getAllUsers) {
  const allUsers = getAllUsers();
  const idx = allUsers.findIndex(u => String(u.telegramId) === String(targetId));
  if (idx === -1) return { ok: false, reason: 'not_found' };
  allUsers.splice(idx, 1);
  return { ok: true };
}

/**
 * إرسال رسالة من المطوّر لمستخدم
 * @param {object} bot - Telegram bot instance
 * @param {string} targetId - معرّف المستخدم الهدف
 * @param {string} text - نص الرسالة
 */
export async function sendDevMessage(bot, targetId, text) {
  await bot.sendMessage(
    targetId,
    `📨 *رسالة من المطوّر:*\n\n${text}`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * تعديل نقاط مستخدم بإشارة (+ أو -)
 * @param {string} targetId - معرّف المستخدم
 * @param {number} amount - الكمية (موجبة دائماً)
 * @param {number} sign - الإشارة: +1 أو -1
 * @param {Function} addPoints - دالة إضافة النقاط
 * @returns {number} الرصيد الجديد
 */
export function modifyUserPoints(targetId, amount, sign, addPoints) {
  const finalAmount = Math.abs(amount) * sign;
  const reason = finalAmount > 0 ? 'إضافة من المطوّر' : 'خصم من المطوّر';
  return addPoints(targetId, finalAmount, reason);
}
