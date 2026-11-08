// dist/handlers/system-handler.mjs
// Domain: System — /start /help /cancel /info + navigation callbacks

import {
  needsNumberPick,
  setActiveNumber,
  buildNumberPickerKeyboard,
  resolveActiveNumber,
} from '../lib/number-profiles.mjs';

export const pluginManifest = {
  name: 'system',
  version: '1.0.0',
  type: 'handler',
  description: 'أوامر النظام: /start /help /cancel /info + navigation callbacks',
  textOrder: 1,
  cbOrder: 1,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

/** عرض شاشة اختيار الرقم */
async function showNumberPicker(bot, chatId, user, context = 'main') {
  const nums = user.whatsappNumbers || [];
  const active = resolveActiveNumber(user);
  const lines = nums.map(n => {
    const isActive = n.number === active;
    return `${isActive ? '✅' : '📱'} ${n.number}`;
  });
  const text =
    `📱 *اختر الرقم الذي تريد إدارته:*\n\n` +
    `عندك *${nums.length}* أرقام مربوطة:\n${lines.join('\n')}\n\n` +
    `كل رقم له إعداداته الخاصة (ميزات رسائلي وغيرها).\n` +
    `النقاط والباقة مشتركة بين جميع الأرقام.`;
  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: buildNumberPickerKeyboard(nums, context),
  });
}

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = String(msg.from?.id);
  const user = _deps.getUser(userId);
  const isDev = userId === _deps.DEVELOPER_ID;

  if (text === '/start' || text === '/menu') {
    await _deps.handleStart(bot, chatId, userId, msg.from);
    // بعد رسالة الترحيب: اعرض منتقي الأرقام إذا عنده أرقام متعددة
    if (needsNumberPick(user)) {
      await showNumberPicker(bot, chatId, user, 'main');
    }
    return true;
  }
  if (text === '/help' || text === '/help_commands') {
    await _deps.handleHelp(bot, chatId, userId);
    return true;
  }
  if (text === '/cancel') {
    _deps.clearState(userId);
    await bot.sendMessage(chatId, '\u2705 \u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0639\u0645\u0644\u064A\u0629', {
      reply_markup: _deps.mainMenuKeyboard(user.points || 0, user.tier, isDev),
    });
    return true;
  }
  if (text === '/info' || text === '/info_profile') {
    await _deps.showInfo(bot, chatId, userId);
    return true;
  }
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);
  const user = _deps.getUser(userId);
  const isDev = userId === _deps.DEVELOPER_ID;

  if (data === 'noop') return true;

  // ── منتقي الرقم (من شاشة البداية) ─────────────────────────────────────
  if (data.startsWith('numbpick_')) {
    const picked = data.slice('numbpick_'.length);
    if (picked !== 'skip') {
      // التحقق: الرقم المختار يجب أن يكون في قائمة أرقام المستخدم الفعلية
      const validNums = (user.whatsappNumbers || []).map(n => n.number);
      if (!validNums.includes(picked)) {
        // [FIX-NUMBPICK] الكولباك مُجاب مسبقاً في callback-handler — يجب عدم رمي خطأ هنا
        await bot.answerCallbackQuery(query.id, { text: '❌ رقم غير صالح' }).catch(() => {});
        await bot.sendMessage(chatId, '❌ رقم غير صالح').catch(() => {});
        return true;
      }
      setActiveNumber(userId, picked);
      await bot.answerCallbackQuery(query.id, { text: `✅ تم اختيار ${picked}` }).catch(() => {});
      await bot.sendMessage(chatId, `✅ تم اختيار الرقم ${picked} كرقم نشط`).catch(() => {});
    } else {
      await bot.answerCallbackQuery(query.id, { text: '🏠 تخطي — ستعمل بدون اختيار رقم' }).catch(() => {});
    }
    const freshUser = _deps.getUser(userId);
    _deps.clearState(userId);
    await bot.sendMessage(chatId, _deps.getWelcomeText(freshUser), {
      parse_mode: 'Markdown',
      reply_markup: _deps.mainMenuKeyboard(freshUser.points || 0, freshUser.tier, isDev),
    });
    return true;
  }

  // ── الرئيسية ────────────────────────────────────────────────────────────
  if (data === 'home' || data === 'back') {
    _deps.clearState(userId);
    await bot.sendMessage(chatId, _deps.getWelcomeText(user), {
      parse_mode: 'Markdown',
      reply_markup: _deps.mainMenuKeyboard(user.points || 0, user.tier, isDev),
    });
    return true;
  }

  if (data === 'cancel') {
    _deps.clearState(userId);
    await bot.sendMessage(chatId, '\u2705 \u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0639\u0645\u0644\u064A\u0629', {
      reply_markup: _deps.mainMenuKeyboard(user.points || 0, user.tier, isDev),
    });
    return true;
  }

  if (data === 'next') {
    const state = _deps.getState(userId);
    if (state.state === 'awaiting_reply_content' || state.state === 'awaiting_long_text') {
      _deps.setState(userId, 'awaiting_reply_target');
      await bot.sendMessage(chatId, '\u{1F465} *\u0627\u062E\u062A\u0631 \u0645\u0646 \u064A\u0633\u062A\u0644\u0645 \u0627\u0644\u0631\u062F:*', {
        parse_mode: 'Markdown',
        reply_markup: _deps.replyTargetKeyboard(),
      });
    }
    return true;
  }

  if (data === 'menu_help') {
    await _deps.showHelp(bot, chatId, userId, user, isDev);
    return true;
  }
  if (data === 'menu_info') {
    await _deps.showInfo2(bot, chatId, userId, user, isDev);
    return true;
  }
  if (data === 'msg_to_dev') {
    await _deps.handleMsgToDev(bot, chatId, userId);
    return true;
  }
  if (data === 'buy_mizaj_stars') {
    await _deps.handleBuyMizajStars(bot, chatId, userId, user);
    return true;
  }

  return false;
}
