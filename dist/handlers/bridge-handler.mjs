// dist/handlers/bridge-handler.mjs
// Domain: Bridge — /bridge + callbacks

export const pluginManifest = {
  name: 'bridge',
  version: '1.0.0',
  type: 'handler',
  description: 'جسر الإرسال الجماعي: /bridge + callbacks',
  textOrder: 9,
  cbOrder: 8,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;

  if (text === '/bridge') {
    await bot.sendMessage(chatId, '\u{1F517} \u0627\u0644\u062C\u0633\u0631', { reply_markup: _deps.bridgeMenuKeyboard() });
    return true;
  }
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  if (data === 'menu_bridge' || data.startsWith('bridge_')) {
    await _deps.handleBridgeCallback(bot, chatId, userId, data);
    return true;
  }

  return false;
}
