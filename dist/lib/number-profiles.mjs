// dist/lib/number-profiles.mjs
// إدارة الملفات الشخصية لكل رقم واتساب
// — الرقم النشط يُحفظ في الذاكرة فقط (يُعاد الاختيار عند كل تشغيل)
// — الإعدادات تُحفظ داخل whatsappNumbers[i].settings (تستمر)

const activeNumbers = new Map(); // telegramId → phoneNumber

/** الرقم الذي اختاره المستخدم في هذه الجلسة */
export function getActiveNumber(userId) {
  return activeNumbers.get(String(userId)) || null;
}

/** تعيين الرقم النشط للمستخدم */
export function setActiveNumber(userId, number) {
  activeNumbers.set(String(userId), String(number));
}

/** مسح الرقم النشط (عند قطع الاتصال مثلًا) */
export function clearActiveNumber(userId) {
  activeNumbers.delete(String(userId));
}

/**
 * حل الرقم النشط:
 * - إذا عنده رقم واحد → يُختار تلقائيًا بدون سؤال
 * - إذا عنده أرقام متعددة → يحتاج يختار يدويًا (يُرجع null إذا لم يختر)
 * - إذا ما عنده أرقام → null
 */
export function resolveActiveNumber(user) {
  const nums = user.whatsappNumbers || [];
  if (nums.length === 1) return nums[0].number;
  if (nums.length === 0) return null;
  return getActiveNumber(user.telegramId);
}

/**
 * هل يحتاج المستخدم لاختيار رقم؟
 * — نعم فقط إذا عنده أرقام متعددة ولم يختر بعد
 */
export function needsNumberPick(user) {
  const nums = user.whatsappNumbers || [];
  if (nums.length <= 1) return false;
  return !getActiveNumber(user.telegramId);
}

/**
 * اقرأ إعدادات رقم بعينه من مصفوفة whatsappNumbers
 * — يُرجع null إذا لم تكن موجودة (سيُفعَّل fallback على DEFAULTS)
 */
export function getNumberSettings(user, phoneNumber) {
  if (!phoneNumber) return null;
  const entry = (user.whatsappNumbers || []).find(n => n.number === phoneNumber);
  return entry?.settings ?? null;
}

/**
 * احفظ إعدادات رقم بعينه داخل مصفوفة whatsappNumbers (يُعدّل المصفوفة مباشرةً)
 * — يجب على المستادي استدعاء saveUser بعد هذا لحفظ التغييرات
 */
export function setNumberSettings(user, phoneNumber, settings) {
  if (!phoneNumber) return;
  const nums = user.whatsappNumbers || [];
  const idx = nums.findIndex(n => n.number === phoneNumber);
  if (idx >= 0) {
    nums[idx] = { ...nums[idx], settings };
    user.whatsappNumbers = nums; // تحديث المرجع
  }
}

/**
 * بناء لوحة مفاتيح اختيار الرقم
 * @param {object[]} numbers - مصفوفة whatsappNumbers
 * @param {string} context - 'mymsgs' أو 'main' — يحدد callback prefix
 */
export function buildNumberPickerKeyboard(numbers, context = 'main') {
  const prefix = context === 'mymsgs' ? 'mymsgs_numbpick_' : 'numbpick_';
  return {
    inline_keyboard: [
      ...numbers.map(n => [{
        text: `📱 ${n.number}`,
        callback_data: `${prefix}${n.number}`,
      }]),
      ...(context === 'main' ? [[{ text: '🏠 تخطي الاختيار', callback_data: 'numbpick_skip' }]] : []),
    ],
  };
}
