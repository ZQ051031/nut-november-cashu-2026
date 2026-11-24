# Demo: move 16 test sats

**Setup:** Open Testnut Pocket as described in the [README](README.md#run-it). Start with a fresh browser profile or note your starting balance. Never pay an invoice or paste real ecash into this app.

1. **Mint**: Leave **Amount** at 64 and click **Mint test sats**. The test mint marks the quote paid automatically. From a fresh profile, the balance rises to **64 test sats** and **Minted** appears under Activity.
2. **Send**: Enter 16 and click **Create token**. Copy the outgoing `cashuB…` token. The demo wallet showed **46 test sats** after a 2-test-sat fee, and a **Sent** activity row. You can reopen the token from that row if you reload.
3. **Receive**: Paste the token into **Receive** and click **Redeem token**. The balance increases by 16 to **62 test sats** in this example, and Activity lists **Received**, **Sent**, and **Minted**. To demonstrate a transfer instead, redeem in a separate browser profile: it starts at 0 and rises to **16 test sats**.
4. **Try it again**: Redeem the same token a second time. The mint rejects it and the balance stays unchanged. Reload the page to verify that the successful activity and balance persist.

Testnut’s fees can vary; Activity shows the actual debit and, when a fee applies, the token amount separately.
