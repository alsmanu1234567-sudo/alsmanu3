// dist/handlers/reports-handler.mjs
// Domain: Reports — /reports + callbacks

export const pluginManifest = {
  name: 'reports',
  version: '1.0.0',
  type: 'handler',
  description: 'البلاغات: /reports + callbacks',
  textOrder: 14,
  cbOrder: 14,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;

  if (text === '/reports') {
    // reportsMenuKeyboard قد لا تكون في _deps مباشرةً
    let kb = {};
    try { kb = _deps.reportsMenuKeyboard?.() || {}; } catch {}
    await bot.sendMessage(chatId, '\u26A1 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A', { reply_markup: kb });
    return true;
  }
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  if (data === 'menu_reports' || data.startsWith('report_') || data.startsWith('rset_') || data.startsWith('rbuy_')) {
    await _deps.handleReportsCallback(bot, chatId, userId, data);
    return true;
  }

  return false;
}
