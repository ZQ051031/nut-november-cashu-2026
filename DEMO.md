# Two-browser test token demo

Use two independent browser profiles (or a normal window and a private window),
both on the same app URL, with the default **Testnut** mint selected. Start with
an empty wallet in each profile.

1. **Alice — Create:** Enter **100** and click **Create test sats**. If it says
   the fake payment is pending, wait briefly and click **Check test quote**.
   Never pay anything. The balance becomes **100 sats**, with a **Created** entry.
2. **Alice — Send:** Enter **25**, click **Create send token**, and copy the token.
   Her balance becomes **75 sats** before any mint fee. The token is available
   again under **Show sent token** in the **Sent** entry.
3. **Bob — Receive:** Paste the token and click **Receive token**. His balance
   becomes **25 sats** before any mint fee; **Received** appears in history.
4. Reload both windows to see each balance and history persist. Paste the same
   token into Bob's wallet again: the mint should reject it and his balance
   should not increase.

If a fee applies, use the credited/debited amounts in history to reconcile the
two balances. Testnut may reset; do not use any funds or rely on these tokens.
