// dist/handlers/calls-handler.mjs
// Domain: Calls — /calls + callbacks
// Phase 9: يستخدم calls/blocklist-service للعمليات على قائمة الحظر

import * as _blocklistSvc from '../services/calls/blocklist-service.mjs';

export const pluginManifest = {
  name: 'calls',
  version: '1.0.0',
  type: 'handler',
  description: 'إدارة المكالمات وقائمة الحظر: /calls + callbacks',
  textOrder: 13,
  cbOrder: 13,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;

  if (text === '/calls') {
    await bot.sendMessage(chatId, '\u{1F4DE} \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A', { reply_markup: _deps.callsMenuKeyboard() });
    return true;
  }
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  if (data === 'menu_calls' || data.startsWith('calls_')) {
    await _deps.handleCallsCallback(bot, chatId, userId, data);
    return true;
  }

  if (data.startsWith('calls_block_quick_')) {
    const callerNum = data.replace('calls_block_quick_', '');
    const freshUser = _deps.getUser(userId);
    const { blocked, wasAlreadyBlocked } = _blocklistSvc.blockCaller(freshUser, callerNum);
    if (!wasAlreadyBlocked) {
      _deps.saveUser(userId, { blockedCallers: blocked });
    }
    await bot.sendMessage(chatId, `\u{1F6AB} \u062A\u0645 \u062D\u0638\u0631 \u0645\u0643\u0627\u0644\u0645\u0627\u062A +${callerNum} \u0628\u0646\u062C\u0627\u062D`, {
      reply_markup: { inline_keyboard: [[{ text: '\u{1F4CB} \u0633\u062C\u0644 \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A', callback_data: 'calls_log' }]] },
    });
    return true;
  }

  return false;
}
