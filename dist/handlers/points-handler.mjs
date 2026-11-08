// dist/handlers/points-handler.mjs
// Domain: Points & Features — /points /features + callbacks

export const pluginManifest = {
  name: 'points',
  version: '1.0.0',
  type: 'handler',
  description: 'نظام النقاط والمميزات: /points /features + callbacks',
  textOrder: 5,
  cbOrder: 4,
  enabled: true,
};

let _deps = {};
export function setDeps(d) { _deps = { ..._deps, ...d }; }

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = String(msg.from?.id);

  if (text === '/points' || text === '/points_balance') {
    await _safeShowPoints(bot, chatId, userId);
    return true;
  }
  if (text === '/features' || text === '/features_list') {
    if (typeof _deps.showFeatures === 'function') {
      await _deps.showFeatures(bot, chatId, userId);
    }
    return true;
  }
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  if (
    data === 'menu_points' ||
    data === 'menu_features' ||
    data.startsWith('points_') ||
    data.startsWith('feature_') ||
    data.startsWith('bundle_') ||
    data === 'redeem_extra_num'
  ) {
    try {
      if (typeof _deps.handlePointsCallback === 'function') {
        await _deps.handlePointsCallback(bot, chatId, userId, data);
      } else {
        console.error('[points-handler] handlePointsCallback غير موجود في deps');
        await _safeShowPoints(bot, chatId, userId);
      }
    } catch (e) {
      console.error('[points-handler] خطأ في handlePointsCallback:', data, String(e));
      const isFeaturesRequest = data === 'menu_features' || data === 'points_buy';
      try {
        if (isFeaturesRequest) {
          // لا نستبدل قائمة الشراء بقائمة النقاط بصمت — نُبلغ المستخدم بالخطأ الحقيقي
          await bot.sendMessage(
            chatId,
            `\u26A0\uFE0F \u062A\u0639\u0630\u0651\u0631 \u0639\u0631\u0636 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u064A\u0632\u0627\u062A \u062D\u0627\u0644\u064A\u0627\u064B\u002E \u0627\u0636\u0641\u0651 /features \u0644\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649\u002E`
          );
        } else {
          await _safeShowPoints(bot, chatId, userId);
        }
      } catch (e2) {
        console.error('[points-handler] خطأ في fallback بعد فشل handlePointsCallback:', String(e2));
        await bot.sendMessage(chatId, `\u26A0\uFE0F \u062E\u0637\u0623 \u0645\u0624\u0642\u062A \u0641\u064A \u0646\u0638\u0627\u0645 \u0627\u0644\u0646\u0642\u0627\u0637`).catch(() => {});
      }
    }
    return true;
  }

  if (data.startsWith('confirm_buy_')) {
    try {
      if (typeof _deps.handleConfirmBuy === 'function') {
        await _deps.handleConfirmBuy(bot, chatId, userId, data.replace('confirm_buy_', ''));
      } else {
        console.error('[points-handler] handleConfirmBuy غير موجود في deps');
        await bot.sendMessage(chatId, `\u26A0\uFE0F \u062E\u0637\u0623 \u0645\u0648\u0642\u062A \u060C \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649`).catch(() => {});
      }
    } catch (e) {
      console.error('[points-handler] خطأ في handleConfirmBuy:', data, String(e));
      try {
        await bot.sendMessage(
          chatId,
          `\u26A0\uFE0F \u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0634\u0631\u0627\u0621\u002E \u0627\u0644\u0631\u062C\u0627\u0621 \u0627\u0644\u062A\u062A\u0623\u0643\u062F \u0645\u0646 \u0631\u0635\u064A\u062F\u0643 \u0648\u0625\u0646 \u062E\u064F\u0635\u0645\u062A \u0627\u0644\u0646\u0642\u0627\u0637 \u062F\u0648\u0646 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0645\u064A\u0632\u0629\u060C \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0637\u0648\u0651\u0631\u002E`
        );
      } catch (e2) {
        console.error('[points-handler] فشل إرسال رسالة خطأ الشراء:', String(e2));
      }
    }
    return true;
  }

  return false;
}

async function _safeShowPoints(bot, chatId, userId) {
  const { getUser, inMemoryDB } = _deps;
  const user = getUser(userId);
  const pts = user.points || 0;
  const tier = user.tier || 'free';
  const TIER_LABELS = { free: 'مجاني', pro: 'برو', promax: 'برو ماكس', khariq: 'خارق', khariqpro: 'خارق للرو', mizaj: 'ميزاج' };
  const log = (inMemoryDB?.pointsLog || [])
    .filter((l) => l.userId === userId)
    .slice(-5)
    .reverse();
  const logText = log.length > 0
    ? log.map((l) => `${l.amount > 0 ? '\uD83D\uDFE2 +' : '\uD83D\uDD34 '}${l.amount} \u2014 ${l.reason}`).join('\n')
    : '\u0644\u0627 \u062A\u0648\u062C\u062F \u062D\u0631\u0643\u0627\u062A \u0628\u0639\u062F';

  const kb = {
    inline_keyboard: [
      [{ text: '\uD83C\uDF81 \u0637\u0631\u0642 \u0643\u0633\u0628 \u0627\u0644\u0646\u0642\u0627\u0637', callback_data: 'points_earn' }, { text: '\uD83D\uDED2 \u0634\u0631\u0627\u0621 \u0645\u064A\u0632\u0627\u062A', callback_data: 'points_buy' }],
      [{ text: '\uD83D\uDCCA \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A\u064A', callback_data: 'points_stats' }, { text: '\uD83D\uDCDC \u0633\u062C\u0644 \u0627\u0644\u062D\u0631\u0643\u0627\u062A', callback_data: 'points_log' }],
      [{ text: '\uD83C\uDF81 \u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0646\u0642\u0627\u0637\u064A \u0628\u0645\u0643\u0627\u0641\u0622\u062A', callback_data: 'points_redeem' }],
      [{ text: '\u2728\uD83D\uDD17 \u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u2014 \u0627\u0631\u0628\u062D 200 \u0646\u0642\u0637\u0629 \u0644\u0643\u0644 \u0635\u062F\u064A\u0642! \uD83D\uDD17\u2728', callback_data: 'points_referral' }],
      [{ text: '\uD83D\uDCE9 \u0631\u0633\u0627\u0644\u0629 \u0644\u0644\u0645\u0637\u0648\u0651\u0631', callback_data: 'msg_to_dev' }],
      [{ text: '\uD83D\uDD19 \u0631\u062C\u0648\u0639', callback_data: 'back' }, { text: '\uD83C\uDFE0 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629', callback_data: 'home' }],
    ]
  };

  await bot.sendMessage(
    chatId,
    `\uD83D\uDCE0 *\u0646\u0642\u0627\u0637\u064A \u0648\u0631\u0635\u064A\u062F\u064A*\n\n` +
    `\uD83D\uDCB0 \u0631\u0635\u064A\u062F\u0643: *${pts.toLocaleString()} \u0646\u0642\u0637\u0629*\n` +
    `\u2B50 \u0641\u0626\u062A\u0643: *${TIER_LABELS[tier] || tier}*\n` +
    `\uD83D\uDCF1 \u0627\u0644\u0623\u0631\u0642\u0627\u0645: *${(user.whatsappNumbers || []).length}/${user.maxNumbers || 1}*\n` +
    `\uD83D\uDC65 \u0625\u062D\u0627\u0644\u0627\u062A\u0643: *${user.referralCount || 0} \u0635\u062F\u064A\u0642*\n\n` +
    `\uD83D\uDCCB *\u0622\u062E\u0631 \u0627\u0644\u062D\u0631\u0643\u0627\u062A:*\n${logText}`,
    { parse_mode: 'Markdown', reply_markup: kb }
  );
}
