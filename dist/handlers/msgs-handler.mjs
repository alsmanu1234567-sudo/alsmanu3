// dist/handlers/msgs-handler.mjs
// Domain: Messages — msgs/mymsgs/viewonce callbacks + handleMyMsgsTextInput2

import {
  needsNumberPick,
  setActiveNumber,
  buildNumberPickerKeyboard,
  resolveActiveNumber,
} from '../lib/number-profiles.mjs';

export const pluginManifest = {
  name: 'msgs',
  version: '1.0.0',
  type: 'handler',
  description: 'رسائلي: msgs/mymsgs/viewonce callbacks',
  textOrder: 17,
  cbOrder: 16,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

// معالج نصي مبكر — يُستدعى بعد أوامر النصوص العادية
export async function handleText(bot, msg) {
  // لا أوامر نصية لهذا الـ domain — فقط state handling عبر handleMyMsgsTextInput2
  return false;
}

/** عرض منتقي الرقم داخل قسم رسائلي */
async function showMyMsgsNumberPicker(bot, chatId, user) {
  const nums = user.whatsappNumbers || [];
  const active = resolveActiveNumber(user);
  const lines = nums.map(n =>
    `${n.number === active ? '✅' : '📱'} ${n.number}`
  );
  const text =
    `📱 *اختر الرقم لإدارة إعداداته:*\n\n` +
    `عندك *${nums.length}* أرقام مربوطة:\n${lines.join('\n')}\n\n` +
    `كل رقم له ميزاته وأوامره الخاصة في قسم *رسائلي*.\n` +
    `النقاط والباقة مشتركة بين جميع الأرقام.`;
  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: buildNumberPickerKeyboard(nums, 'mymsgs'),
  });
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  // ── منتقي الرقم الخاص بقسم رسائلي ────────────────────────────────────
  if (data.startsWith('mymsgs_numbpick_')) {
    const picked = data.slice('mymsgs_numbpick_'.length);
    const user = _deps.getUser(userId);
    // التحقق: الرقم المختار يجب أن يكون في قائمة أرقام المستخدم الفعلية
    const validNums = (user.whatsappNumbers || []).map(n => n.number);
    if (!validNums.includes(picked)) {
      await bot.answerCallbackQuery(query.id, { text: '❌ رقم غير صالح' });
      return true;
    }
    setActiveNumber(userId, picked);
    await bot.answerCallbackQuery(query.id, { text: `✅ تم اختيار ${picked}` });
    // بعد الاختيار: اعرض قائمة رسائلي مباشرةً
    await _deps.handleMyMsgsCallback(bot, chatId, userId, 'menu_mymsgs');
    return true;
  }

  if (data === 'menu_msgs' || data.startsWith('msgs_')) {
    await _deps.handleMsgsCallback(bot, chatId, userId, data);
    return true;
  }

  if (data === 'menu_mymsgs' || data.startsWith('mymsgs_')) {
    const user = _deps.getUser(userId);
    // إذا عنده أرقام متعددة ولم يختر رقمًا → اعرض منتقي الرقم أولًا
    if (data === 'menu_mymsgs' && needsNumberPick(user)) {
      await bot.answerCallbackQuery(query.id, { text: '📱 اختر الرقم أولاً' }).catch(() => {});
      await showMyMsgsNumberPicker(bot, chatId, user);
      return true;
    }
    await _deps.handleMyMsgsCallback(bot, chatId, userId, data);
    return true;
  }

  if (data === 'menu_viewonce' || data.startsWith('viewonce_')) {
    await _deps.handleMsgsCallback(bot, chatId, userId, data.startsWith('viewonce_') ? `msgs_${data}` : 'msgs_viewonce_toggle');
    return true;
  }

  return false;
}
