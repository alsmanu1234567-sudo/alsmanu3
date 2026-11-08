// dist/handlers/security-handler.mjs
// Domain: Security — /security + callbacks

export const pluginManifest = {
  name: 'security',
  version: '1.0.0',
  type: 'handler',
  description: 'حماية القناة والأمان: /security + callbacks',
  textOrder: 10,
  cbOrder: 9,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;

  if (text === '/security') {
    await bot.sendMessage(chatId, '\u{1F6E1}\uFE0F \u0627\u0644\u0623\u0645\u0627\u0646', { reply_markup: _deps.securityMenuKeyboard() });
    return true;
  }
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  if (data === 'menu_security' || data.startsWith('sec_')) {
    await _deps.handleSecurityCallback(bot, chatId, userId, data);
    return true;
  }

  return false;
}
