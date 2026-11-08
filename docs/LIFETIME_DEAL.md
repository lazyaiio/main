# Lifetime deal highlight (Batch 21)

## What visitors see (only while the deal is really on sale)
- A gold badge in the site header (desktop and mobile menu), linking to the deal on /pricing.
- A slim gold strip under the hero on the home page: headline, "From BDT X one time", days left (if an end date is set).
- A big dark card at the top of /pricing with the headline, the text, every lifetime price, the end date and a "Get lifetime access" button.
- A gold ribbon, gold border and a lifetime price box on each plan card that sells a lifetime option.
- A badge on the checkout page when the person is buying a lifetime plan.

## What you control: Admin -> Plans -> "Lifetime deal highlight"
- Show the lifetime deal (on/off), badge (24 characters), headline (80), text under the headline (200), and an optional end date (UTC).
- The panel says "Showing on the site" or "Not showing" and tells you why. The highlight is hidden when:
  the deal is off, the end date passed, the site currency is not BDT (bKash checkout needs BDT), or no visible paid plan has a lifetime price with "Lifetime available" switched on.
- Everything is English only (Bengali characters and < > are refused).

## Setting up a deal
1. Admin -> Plans: for each plan you want to sell for life, fill the lifetime price and switch "Lifetime available" on. Save.
2. In "Lifetime deal highlight": tick "Show the lifetime deal", write the badge and headline, set an end date only if you mean it, and save.
3. Open the home page and /pricing in a private window to check. The site caches the deal for up to one minute.

## Ending a deal
- **With an end date:** at the end of that day (UTC) the scheduler (checked every ten minutes) switches "Lifetime available" OFF on every plan and turns the deal off. Nobody can buy lifetime after that. People who already bought keep their lifetime plan. To run another deal later, switch "Lifetime available" on again for the plans and save a new deal.
- **Without an end date:** the deal stays until you untick "Show the lifetime deal". Unticking only hides the highlight; lifetime stays for sale on each plan as long as its "Lifetime available" switch is on. To stop selling lifetime, switch that off on the plan.

## Honesty rules built in
- There are no fake counters. The only urgency shown is a real end date that really closes sales, or nothing.
- The highlight never appears for something that cannot be bought.
- Before using words such as "forever" or "lifetime of the product" in the text, check what your Terms of Service promise for lifetime plans. The default text avoids such claims.
