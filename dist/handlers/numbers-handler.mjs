// dist/handlers/numbers-handler.mjs
// Domain: Numbers & Lookup — /numbers /lookup + callbacks
// Phase 9: يستخدم users/limit-service لفحص الحدود اليومية

import * as _limitSvc from '../services/users/limit-service.mjs';

export const pluginManifest = {
  name: 'numbers',
  version: '1.0.0',
  type: 'handler',
  description: 'الأرقام والبحث: /numbers /lookup + callbacks',
  textOrder: 11,
  cbOrder: 11,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = String(msg.from?.id);
  const user = _deps.getUser(userId);

  if (text === '/numbers') {
    await _deps.handleNumbersMenu(bot, chatId, userId);
    return true;
  }

  if (text === '/lookup' || text.startsWith('/lookup ')) {
    const inlineNum = text.replace('/lookup', '').trim();
    if (inlineNum) {
      const { getLookupCount, getLookupLimit, lookupPhoneWhatsApp, formatLookupResult, incrementLookupCount } = await _deps._mod_phone_lookup();
      const { count } = getLookupCount(userId);
      const limit = getLookupLimit(user.tier);
      const { allowed } = _limitSvc.checkDailyLimit(count, limit);
      if (!allowed) {
        await bot.sendMessage(chatId, _limitSvc.limitReachedMessage(count, limit));
        return true;
      }
      await bot.sendMessage(chatId, '\u{1F50D} \u062C\u0627\u0631\u064A \u0627\u0644\u0628\u062D\u062B...');
      incrementLookupCount(userId);
      const result = await lookupPhoneWhatsApp(userId, inlineNum.replace(/\D/g, ''));
      const { phoneLookupKeyboard } = await _deps._mod_keyboards();
      await bot.sendMessage(chatId, formatLookupResult(result), { parse_mode: 'Markdown', reply_markup: phoneLookupKeyboard() });
    } else {
      const { phoneLookupKeyboard } = await _deps._mod_keyboards();
      const { getLookupCount, getLookupLimit } = await _deps._mod_phone_lookup();
      const { count } = getLookupCount(userId);
      const limit = getLookupLimit(user.tier);
      const limitText = _limitSvc.formatLimit(limit);
      await bot.sendMessage(chatId, `\u{1F50D} *\u0628\u062D\u062B \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0631\u0642\u0645*\n\n\u0628\u062D\u0648\u062B \u0627\u0644\u064A\u0648\u0645: ${count}/${limitText}\n\n\u0627\u0636\u063A\u0637 \u0628\u062D\u062B \u0648\u0623\u062F\u062E\u0644 \u0627\u0644\u0631\u0642\u0645:`, {
        parse_mode: 'Markdown',
        reply_markup: phoneLookupKeyboard(),
      });
    }
    return true;
  }

  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  // [REMOVED] قسم إدارة الأرقام حُذف بطلب المستخدم — أي زر قديم يعيد للقائمة الرئيسية
  if (data === 'menu_numbers' || data.startsWith('nummgr_') || data.startsWith('num_')) {
    await bot.answerCallbackQuery(query.id, { text: 'هذا القسم لم يعد متاحاً' }).catch(() => {});
    await bot.sendMessage(chatId, 'تم حذف قسم إدارة الأرقام.\n\nيمكنك إدارة أرقامك من قسم "ربط واتساب".', {
      reply_markup: { inline_keyboard: [[{ text: '\u{1F3E0} \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629', callback_data: 'home' }]] },
    }).catch(() => {});
    return true;
  }

  if (data === 'menu_lookup' || data.startsWith('lookup_')) {
    const handled = await _deps.handleNumbersCallback(bot, chatId, userId, data);
    if (!handled) await _deps.handleNumberCallback(bot, chatId, userId, data);
    return true;
  }

  return false;
}
