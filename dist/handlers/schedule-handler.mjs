// dist/handlers/schedule-handler.mjs
// Domain: Schedule — /schedule + callbacks

export const pluginManifest = {
  name: 'schedule',
  version: '1.0.0',
  type: 'handler',
  description: 'الرسائل المجدولة: /schedule + callbacks',
  textOrder: 15,
  cbOrder: 15,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;

  if (text === '/schedule') {
    await bot.sendMessage(chatId, '\u{1F4C5} \u0627\u0644\u062C\u062F\u0648\u0644\u0629', { reply_markup: _deps.scheduleMenuKeyboard() });
    return true;
  }
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  if (data === 'menu_schedule' || data.startsWith('schedule_') || data.startsWith('sched_')) {
    await _deps.handleScheduleCallback(bot, chatId, userId, data);
    return true;
  }

  return false;
}
