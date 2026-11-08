// dist/handlers/status-handler.mjs
// Domain: Status — /status + callbacks

export const pluginManifest = {
  name: 'status',
  version: '1.0.0',
  type: 'handler',
  description: 'عرض الحالات: /status + callbacks',
  textOrder: 12,
  cbOrder: 12,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;

  if (text === '/status') {
    // statusMenuKeyboard قد لا تكون في _deps مباشرةً — نجرّب عبر _mod_status
    let kb = {};
    try { const m = await _deps._mod_status(); kb = m.statusMenuKeyboard?.() || {}; } catch {}
    await bot.sendMessage(chatId, '\u{1F4CA} \u0627\u0644\u062D\u0627\u0644\u0627\u062A', { reply_markup: kb });
    return true;
  }
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  if (data === 'menu_status' || data.startsWith('status_')) {
    await _deps.handleStatusCallback(bot, chatId, userId, data);
    return true;
  }

  return false;
}
