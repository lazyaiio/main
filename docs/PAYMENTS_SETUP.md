# Payments (bKash) setup

Batch 15B. Uses bKash **Tokenized Checkout (API v1.2.0-beta)**. Always start in **sandbox**.

## Prerequisites
- Migrations `0015` and `0016` are run. `TOKEN_ENCRYPTION_KEY` is set in Vercel (credentials are stored encrypted with it).
- `NEXT_PUBLIC_APP_URL` is your real site address (bKash sends customers back to `<it>/api/payments/bkash/callback`).
- The every-minute scheduler is running (it also moves expired plans back to Free).
- The site currency is **BDT** (Admin -> Plans). bKash only takes taka.

## Steps
1. Admin -> **Payments**: paste App Key, App Secret, Username, Password from the bKash sandbox. Keep Mode = Sandbox. Save, then **Test connection**.
2. Tick "Accept bKash payments" and Save.
3. Admin -> Plans: set prices (monthly, yearly, lifetime) and, for lifetime, "Offer the lifetime option now" when you want it visible.
4. Sign in with a test account, open **Billing**, pay with the bKash sandbox test wallet from the bKash developer documentation. Check: Billing shows the plan and end date; Admin -> Payments shows the payment as completed.
5. Before real money: ask bKash to approve your merchant for live, get live credentials, set Mode = Live (you must type LIVE; payments switch off on a mode change), Test connection, turn payments on, make one small real payment and refund it in the bKash merchant portal.

## How it works (so you can trust it)
- The amount is read from your plan in the database when the payment starts; the customer's browser never sends a price.
- When bKash sends the customer back, the site does **not** believe the address. It asks bKash (execute, then status) and only accepts it when the status is Completed, the amount equals what was saved, and the invoice number matches. Then `apply_paid_plan` sets the plan, once (a second call does nothing).
- Monthly = 1 month, yearly = 1 year from payment; renewing the same plan before it ends continues from the end date. Lifetime never expires. Plans do not renew by themselves. When time runs out the scheduler moves the workspace to Free. AI-post counts are per calendar month, so nothing rolls over.
- A plan you set by hand in Admin -> Plans never expires.

## Not included yet
Automatic refunds (do them in the bKash portal, then change the plan by hand), emailed receipts and expiry reminders (Batch 19), recurring/agreement payments.
