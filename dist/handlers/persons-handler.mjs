// dist/handlers/persons-handler.mjs
// Domain: Persons — /persons + callbacks

export const pluginManifest = {
  name: 'persons',
  version: '1.0.0',
  type: 'handler',
  description: 'جهات الاتصال: /persons + callbacks',
  textOrder: 8,
  cbOrder: 7,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;

  if (text === '/persons') {
    await bot.sendMessage(chatId, '\u{1F464} \u0627\u0644\u0623\u0634\u062E\u0627\u0635', { reply_markup: _deps.personsMenuKeyboard() });
    return true;
  }
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  if (
    data === 'menu_persons' ||
    data.startsWith('person_') ||
    data.startsWith('pchat_') ||
    data.startsWith('pset_') ||
    data.startsWith('psetting_') ||
    data.startsWith('contacts_p') ||
    data.startsWith('contact_pick_') ||
    data.startsWith('picker_') ||
    data.startsWith('pu_limit_sel_')
  ) {
    await _deps.handlePersonsCallback(bot, chatId, userId, data);
    return true;
  }

  return false;
}
