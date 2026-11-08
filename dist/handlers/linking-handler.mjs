// dist/handlers/linking-handler.mjs
// Domain: Linking — /link /link_qr /link_number + connect callbacks

export const pluginManifest = {
  name: 'linking',
  version: '1.0.0',
  type: 'handler',
  description: 'ربط جلسات واتسآب: /link /link_qr /link_number + connect callbacks',
  textOrder: 3,
  cbOrder: 2,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = String(msg.from?.id);

  if (text === '/link' || text === '/link_list') {
    await _deps.showConnect(bot, chatId, userId);
    return true;
  }
  if (text === '/link_qr') {
    await _deps.handleLinkQr(bot, chatId, userId);
    return true;
  }
  if (text === '/link_number') {
    await _deps.handleLinkNumber(bot, chatId, userId);
    return true;
  }
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  // [FIX-NUMPICK] numsel_/numpage_ أزرار قائمة الأرقام في /start لم تكن موجّهة لأي معالج
  if (data === 'menu_connect' || data.startsWith('connect_') || data.startsWith('disconnect_') || data.startsWith('numsel_') || data.startsWith('numpage_')) {
    await _deps.handleLinkingCallback(bot, chatId, userId, data);
    return true;
  }

  if (data === 'connect_reconnect') {
    const { reconnectSession, sessions } = await _deps._mod_baileys_session();
    const allKeys = [...(sessions ? sessions.keys() : [])].filter(k => k === userId || k.startsWith(userId + '_+'));
    const keysRc = allKeys.length > 0 ? allKeys : [userId];
    for (const sk of keysRc) {
      try { await reconnectSession(sk, chatId); } catch (e2) { /* continue */ }
    }
    return true;
  }

  return false;
}
