// dist/handlers/payment-handler.mjs
// Phase 7: Payment Handler — مُستخرَج من dist/index.mjs
// [PATCH_PHASE7_PAYMENT_EXTRACTED]
//
// الواجهة:
//   setDeps({ DEVELOPER_ID, _getDatabase, _getConstants }) — DI
//   handlePayment(bot, msg)                                — exported handler

let _deps = {};

export function setDeps(d) {
  _deps = { ..._deps, ...d };
}

export async function handlePayment(bot2, msg2) {
  const { DEVELOPER_ID, _getDatabase, _getConstants } = _deps;
  const _uid = String(msg2.from?.id);
  const _pay = msg2.successful_payment;

  if (_pay.invoice_payload === "mizaj_stars_purchase") {
    const { saveUser: _sv } = await Promise.resolve().then(_getDatabase);
    const { TIER_MAX_NUMBERS: _tmn } = await Promise.resolve().then(_getConstants);

    _sv(_uid, { tier: "mizaj", maxNumbers: _tmn["mizaj"] || 999 });

    await bot2.sendMessage(
      msg2.chat.id,
      "\uD83C\uDF89 *\u0634\u0643\u0631\u0627\u064B \u0639\u0644\u0649 \u062F\u0639\u0645\u0643!*\n\n"
      + "\u2705 \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 *\u0645\u064A\u0632\u0627\u062C* \u0628\u0646\u062C\u0627\u062D!\n"
      + "\u2B50 1 \u0646\u062C\u0645\u0629 \u062A\u064A\u0644\u064A\u063A\u0631\u0627\u0645 \u062A\u0644\u0642\u0651\u0627\u0647\u0627 \u0627\u0644\u0645\u0637\u0648\u0631\n\n"
      + "\uD83D\uDD25\uD83D\uDD25 \u0627\u0633\u062A\u0645\u062A\u0639 \u0628\u062C\u0645\u064A\u0639 \u0645\u064A\u0632\u0627\u062A \u0645\u064A\u0632\u0627\u062C \u0627\u0644\u0622\u0646!",
      { parse_mode: "Markdown" }
    );

    const _dv2 = parseInt(DEVELOPER_ID);
    if (!isNaN(_dv2)) {
      await bot2.sendMessage(
        _dv2,
        "\u2B50 *\u062F\u0641\u0639\u0629 \u0646\u062C\u0648\u0645 \u062C\u062F\u064A\u062F\u0629!*\n\n"
        + "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: " + _uid
        + "\n\u0627\u0644\u0645\u064A\u0632\u0629: \u0645\u064A\u0632\u0627\u062C"
        + "\n\u0627\u0644\u0645\u0628\u0644\u063A: 1 \u0646\u062C\u0645\u0629"
      ).catch(() => {});
    }
  }
}
