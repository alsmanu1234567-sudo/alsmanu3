let _deps = {};
export function setDeps(d) { _deps = d; }

export async function handleReportsCallback(bot2, chatId, userId, data) {
  const { getUser, saveUser, setState, cancelKeyboard, reportsMenuKeyboard, getAllUsers, DEVELOPER_ID, addPoints } = _deps;
  const user = getUser(userId);
  if (data === "menu_reports") {
    const reports = user.reportsSent || 0;
    const stars = user.reportsStarsSent || 0;
    const pointsFromReports = Math.floor(reports / 20) * 1e3;
    await bot2.sendMessage(
      chatId,
      `\u{1F4E2} *\u0642\u0633\u0645 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A*

\u{1F4E4} \u0628\u0644\u0627\u063A\u0627\u062A\u0643: ${reports}
\u2B50 \u0646\u062C\u0648\u0645 \u0645\u064F\u0631\u0633\u064E\u0644\u0629: ${stars}
\u{1F4B0} \u0646\u0642\u0627\u0637 \u0645\u0643\u062A\u0633\u0628\u0629: ${pointsFromReports.toLocaleString()}

\u{1F4A1} \u0643\u0644 20 \u0628\u0644\u0627\u063A = 1,000 \u0646\u0642\u0637\u0629
\u{1F4A1} \u0643\u0644 200 \u0628\u0644\u0627\u063A = \u2B50 \u0644\u0644\u0645\u0637\u0648\u0631`,
      { parse_mode: "Markdown", reply_markup: reportsMenuKeyboard() }
    );
    return true;
  }
  if (data === "report_send") {
    setState(userId, "awaiting_report_target");
    await bot2.sendMessage(
      chatId,
      `\u{1F4E2} *\u0625\u0631\u0633\u0627\u0644 \u0628\u0644\u0627\u063A*

\u0623\u0631\u0633\u0644 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648 \u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0630\u064A \u062A\u0631\u064A\u062F \u0627\u0644\u0625\u0628\u0644\u0627\u063A \u0639\u0646\u0647:

\u064A\u0645\u0643\u0646\u0643 \u0623\u064A\u0636\u0627\u064B \u0648\u0635\u0641 \u0627\u0644\u0645\u0634\u0643\u0644\u0629.`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "report_stats") {
    const reports = user.reportsSent || 0;
    const stars = user.reportsStarsSent || 0;
    const pointsFromReports = Math.floor(reports / 20) * 1e3;
    const nextMilestone20 = 20 - reports % 20;
    const nextMilestone200 = 200 - reports % 200;
    await bot2.sendMessage(
      chatId,
      `\u{1F4CA} *\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A*

\u{1F4E4} \u0645\u064F\u0631\u0633\u064E\u0644\u0629: ${reports}
\u{1F4B0} \u0646\u0642\u0627\u0637 \u0645\u0643\u062A\u0633\u0628\u0629: ${pointsFromReports.toLocaleString()}
\u2B50 \u0646\u062C\u0648\u0645 \u0623\u064F\u0631\u0633\u0650\u0644\u062A: ${stars}

*\u0627\u0644\u0645\u0633\u0627\u0641\u0629 \u0644\u0644\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629:*
\u2022 \u0646\u0642\u0627\u0637: ${nextMilestone20} \u0628\u0644\u0627\u063A (1,000 \u0646\u0642\u0637\u0629)
\u2022 \u0646\u062C\u0645\u0629: ${nextMilestone200} \u0628\u0644\u0627\u063A (\u0646\u062C\u0645\u0629 \u0644\u0644\u0645\u0637\u0648\u0631)`,
      { parse_mode: "Markdown", reply_markup: reportsMenuKeyboard() }
    );
    return true;
  }
  if (data === "report_rewards") {
    const reports = user.reportsSent || 0;
    const stars   = user.reportsStarsSent || 0;
    const nextPts   = 20 - (reports % 20 || 20);
    const nextStar  = 200 - (reports % 200 || 200);
    await bot2.sendMessage(
      chatId,
      `ℹ️ *جدول مكافآت البلاغات*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📢 *نقاط البلاغات:*\n` +
      `• كل 20 بلاغ  → 💰 *1,000 نقطة*\n` +
      `• كل 200 بلاغ → ⭐ *نجمة تقييم للمطوّر*\n\n` +
      `📊 *إحصائياتك الحالية:*\n` +
      `📤 بلاغاتك: *${reports.toLocaleString()}*\n` +
      `⭐ نجوم أُرسلت: *${stars}*\n\n` +
      `⏳ *للمكافأة التالية:*\n` +
      `• ${nextPts < 20 ? nextPts : 20} بلاغ → 1,000 نقطة\n` +
      `• ${nextStar < 200 ? nextStar : 200} بلاغ → نجمة ⭐\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `💡 *نقاط أخرى:*\n` +
      `• تسجيل أول مرة → +100 نقطة\n` +
      `• دعوة صديق → +200 نقطة\n` +
      `• رد تلقائي جديد → +5 نقاط\n` +
      `• ردّ ذكاء اصطناعي → +10 نقاط`,
      { parse_mode: "Markdown", reply_markup: reportsMenuKeyboard() }
    );
    return true;
  }
  if (data === "report_settings") {
    const s = user.reportSettings || {};
    const kb = {
      inline_keyboard: [
        [{ text: `\u{1F514} \u0625\u0634\u0639\u0627\u0631 \u0639\u0646\u062F \u0627\u0644\u0631\u062F: ${s.notifyReply ? "\u2705" : "\u274C"}`, callback_data: "rset_notify" }],
        [{ text: `\u{1F4CA} \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u062A\u0644\u0642\u0627\u0626\u064A\u0629: ${s.autoStats ? "\u2705" : "\u274C"}`, callback_data: "rset_stats" }],
        [{ text: "\u{1F519} \u0631\u062C\u0648\u0639", callback_data: "menu_reports" }]
      ]
    };
    await bot2.sendMessage(chatId, `\u2699\uFE0F *\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A*`, { parse_mode: "Markdown", reply_markup: kb });
    return true;
  }
  if (data === "rset_notify") {
    const s = { ...user.reportSettings || {}, notifyReply: !user.reportSettings?.notifyReply };
    saveUser(userId, { reportSettings: s });
    await bot2.sendMessage(chatId, `\u2705 \u0625\u0634\u0639\u0627\u0631 \u0639\u0646\u062F \u0627\u0644\u0631\u062F: ${s.notifyReply ? "\u0645\u0641\u0639\u0651\u0644" : "\u0645\u0639\u0637\u0651\u0644"}`);
    return true;
  }
  if (data === "rset_stats") {
    const s = { ...user.reportSettings || {}, autoStats: !user.reportSettings?.autoStats };
    saveUser(userId, { reportSettings: s });
    await bot2.sendMessage(chatId, `\u2705 \u0627\u0644\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A\u0629: ${s.autoStats ? "\u0645\u0641\u0639\u0651\u0644\u0629" : "\u0645\u0639\u0637\u0651\u0644\u0629"}`);
    return true;
  }
  if (data === "report_top_reporters") {
    if (userId !== DEVELOPER_ID) {
      await bot2.sendMessage(chatId, "\u274C \u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
      return true;
    }
    const users = getAllUsers().filter((u3) => (u3.reportsSent || 0) > 0).sort((a2, b) => (b.reportsSent || 0) - (a2.reportsSent || 0)).slice(0, 10);
    const text = users.map(
      (u3, i) => `${i + 1}. ${u3.firstName || u3.telegramId} \u2014 ${(u3.reportsSent || 0).toLocaleString()} \u0628\u0644\u0627\u063A`
    ).join("\n") || "\u0644\u0627 \u064A\u0648\u062C\u062F";
    await bot2.sendMessage(chatId, `\u{1F3C6} *\u0623\u0643\u062B\u0631 \u0627\u0644\u0645\u064F\u0628\u0644\u0650\u0651\u063A\u064A\u0646:*\n\n${text}`, { parse_mode: "Markdown" });
    return true;
  }

  // ── متجر البلاغات ───────────────────────────────────────────────────────
  if (data === "report_store") {
    const userPts = user.points || 0;
    const reports = user.reportsSent || 0;
    const kb = {
      inline_keyboard: [
        [
          { text: `10 \u0628\u0644\u0627\u063A — 500 \u0646\u0642\u0637\u0629`, callback_data: "rbuy_10" },
          { text: `50 \u0628\u0644\u0627\u063A — 2,500 \u0646\u0642\u0637\u0629`, callback_data: "rbuy_50" },
        ],
        [
          { text: `100 \u0628\u0644\u0627\u063A — 5,000 \u0646\u0642\u0637\u0629`, callback_data: "rbuy_100" },
          { text: `500 \u0628\u0644\u0627\u063A — 25,000 \u0646\u0642\u0637\u0629`, callback_data: "rbuy_500" },
        ],
        [{ text: `\u2328\uFE0F \u0643\u0645\u064A\u0629 \u0645\u062E\u0635\u0635\u0629`, callback_data: "rbuy_custom" }],
        [{ text: "\u{1F519} \u0631\u062C\u0648\u0639", callback_data: "menu_reports" }]
      ]
    };
    await bot2.sendMessage(
      chatId,
      `\uD83D\uDED2 *\u0645\u062A\u062C\u0631 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A*\n\n` +
      `\uD83D\uDCB0 \u0631\u0635\u064A\u062F\u0643: *${userPts.toLocaleString()} \u0646\u0642\u0637\u0629*\n` +
      `\uD83D\uDCCA \u0628\u0644\u0627\u063A\u0627\u062A\u0643: *${reports.toLocaleString()}*\n\n` +
      `\u{1F4A1} \u0633\u0639\u0631 \u0627\u0644\u0628\u0644\u0627\u063A: *50 \u0646\u0642\u0637\u0629 / \u0628\u0644\u0627\u063A*\n\n` +
      `\u0627\u062E\u062A\u0631 \u0643\u0645\u064A\u0629:`,
      { parse_mode: "Markdown", reply_markup: kb }
    );
    return true;
  }

  // شراء كميات جاهزة
  if (data.startsWith("rbuy_")) {
    const part = data.replace("rbuy_", "");

    if (part === "custom") {
      setState(userId, "awaiting_report_buy_count");
      await bot2.sendMessage(
        chatId,
        `\u2328\uFE0F *\u0627\u0643\u062A\u0628 \u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629:*\n\n\u0633\u0639\u0631: 50 \u0646\u0642\u0637\u0629 / \u0628\u0644\u0627\u063A\n\u0631\u0635\u064A\u062F\u0643: *${(user.points || 0).toLocaleString()} \u0646\u0642\u0637\u0629*`,
        { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
      );
      return true;
    }

    const qty = parseInt(part, 10);
    if (!qty || qty < 1) return false;

    const cost = qty * 50;
    const userPts = user.points || 0;

    if (userPts < cost) {
      await bot2.sendMessage(
        chatId,
        `\u274C *\u0631\u0635\u064A\u062F\u0643 \u063A\u064A\u0631 \u0643\u0627\u0641\u064D!*\n\n\u062A\u062D\u062A\u0627\u062C: *${cost.toLocaleString()} \u0646\u0642\u0637\u0629*\n\u0631\u0635\u064A\u062F\u0643: *${userPts.toLocaleString()} \u0646\u0642\u0637\u0629*\n\u0646\u0642\u0635: *${(cost - userPts).toLocaleString()} \u0646\u0642\u0637\u0629*`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "\uD83D\uDD19 \u0631\u062C\u0648\u0639", callback_data: "report_store" }]] } }
      );
      return true;
    }

    if (typeof addPoints === "function") {
      addPoints(userId, -cost, `\u0634\u0631\u0627\u0621 ${qty} \u0628\u0644\u0627\u063A \u0645\u0646 \u0627\u0644\u0645\u062A\u062C\u0631`);
    }
    const prevR = user.reportsSent || 0;
    saveUser(userId, { reportsSent: prevR + qty });

    await bot2.sendMessage(
      chatId,
      `\u2705 *\u062A\u0645 \u0634\u0631\u0627\u0621 ${qty} \u0628\u0644\u0627\u063A \u0628\u0646\u062C\u0627\u062D!*\n\n` +
      `\uD83D\uDCB0 \u062E\u0635\u0645: *${cost.toLocaleString()} \u0646\u0642\u0637\u0629*\n` +
      `\uD83D\uDCCA \u0625\u062C\u0645\u0627\u0644\u064A \u0628\u0644\u0627\u063A\u0627\u062A\u0643: *${(prevR + qty).toLocaleString()}*\n` +
      `\uD83D\uDCB3 \u0631\u0635\u064A\u062F\u0643 \u0627\u0644\u0645\u062A\u0628\u0642\u064A: *${(userPts - cost).toLocaleString()} \u0646\u0642\u0637\u0629*`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "\uD83D\uDCE2 \u0625\u0631\u0633\u0627\u0644 \u0628\u0644\u0627\u063A \u0627\u0644\u0622\u0646", callback_data: "report_send" }],
            [{ text: "\uD83D\uDED2 \u0645\u062A\u062C\u0631 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A", callback_data: "report_store" }, { text: "\uD83C\uDFE0 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", callback_data: "home" }],
          ]
        }
      }
    );
    return true;
  }

  return false;
}
