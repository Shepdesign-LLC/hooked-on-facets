# Set up hooked on facets Pro in Creem

Hooked on Facets Pro is sold and licensed through [Creem](https://creem.io). The free plugin has no store setup. It's on WordPress.org and contacts nothing.

Three pieces work together:

| Piece | What it does | Where it lives |
|---|---|---|
| **Creem** | Checkout, tax, receipts, license keys | Your Creem dashboard |
| **License server** | Checks keys with Creem and hands licensed sites the Pro ZIP | Vercel, from `license-server/` in the Pro repo |
| **Pro plugin** | Takes the key on **Hooked on Facets → License**, gets updates on the WordPress Updates screen | Customer sites |

Do everything in **test mode** first (Parts 1–6), then switch to live (Part 7). Test mode uses fake cards and keeps its data apart from live.

You need core **1.6.0+** and Pro **1.4.0+**.

Dashboards change their wording now and then. If a button is named slightly differently, pick the closest match. The values you copy are what matter.

---

## Part 1. Turn on test mode in Creem

1. Open:

   ```text
   https://creem.io/dashboard
   ```

2. Sign in, or create an account.
3. At the **bottom of the left sidebar**, switch **Test Mode** on.
4. The dashboard now shows a test-mode banner. Everything you create until Part 7 lives in test mode.

---

## Part 2. Create the Pro product

1. In the left sidebar, click **Products**.
2. Click **Create product**.
3. **Name**, paste:

   ```text
   Hooked on Facets Pro
   ```

4. Set the price and choose **one-time** or **subscription** (yearly is the usual choice for plugins).
5. Scroll to **Delivery**. Click **Add**, then choose **New license key**.
6. **Limit activations**: type how many sites one license covers (for example `1`, `5` or `25`).
7. **Expiration**:
   - One-time product with lifetime updates: leave **expiration off**.
   - Subscription: leave expiration off too, then confirm in Part 6 that cancelling a test subscription turns its key off.
8. Click **Save**.
9. Open the product again and copy its **product ID**. It starts with `prod_`. You'll paste it into Vercel in Part 5 as **`CREEM_PRODUCT_HOOKED_ON_FACETS_PRO`**.

---

## Part 3. Copy your test API key

1. In the left sidebar, click **Developers**.
2. Under **API keys**, copy the test key.
3. You'll paste it into Vercel in Part 5 as **`CREEM_API_KEY`**.

> **Never** paste this key into the plugin, `wp-config.php`, a chat, an email or the repo. Only Vercel gets it.

---

## Part 4. Create a GitHub token for the license server

The license server needs this token to hand licensed sites the Pro ZIP from the private Pro repo's releases.

1. Open:

   ```text
   https://github.com/settings/personal-access-tokens/new
   ```

2. **Token name**, paste:

   ```text
   shepdesign-license-server
   ```

3. **Expiration**: pick the longest option you're comfortable with, and put a calendar reminder for the renewal date.
4. **Resource owner**: choose **Shepdesign-LLC**.
5. **Repository access**: choose **Only select repositories**, then pick **hooked-on-facets-pro**.
6. **Permissions → Repository permissions → Contents**: set to **Read-only**. Leave every other permission at **No access**.
7. Click **Generate token**. If GitHub says the organization must approve the token, an org owner approves it under **Shepdesign-LLC → Settings → Personal access tokens → Pending requests**.
8. Copy the token. It goes into Vercel in Part 5 as **`GITHUB_TOKEN`**.

---

## Part 5. Deploy the license server on Vercel

1. Open:

   ```text
   https://vercel.com/new
   ```

2. Under **Import Git Repository**, find **hooked-on-facets-pro** and click **Import**.
3. **Project Name**, paste:

   ```text
   shepdesign-license-server
   ```

4. **Framework Preset**: choose **Other**.
5. **Root Directory**: click **Edit**, choose **license-server**, click **Continue**.
6. Open **Environment Variables** and add these five rows. Type each name in the **Key** field and its value in the **Value** field.

   Name:

   ```text
   CREEM_MODE
   ```

   Value:

   ```text
   test
   ```

   Name:

   ```text
   CREEM_API_KEY
   ```

   Value: the test API key from Part 3.

   Name:

   ```text
   CREEM_PRODUCT_HOOKED_ON_FACETS_PRO
   ```

   Value: the `prod_…` ID from Part 2.

   Name:

   ```text
   GITHUB_TOKEN
   ```

   Value: the token from Part 4.

   Name:

   ```text
   DOWNLOAD_SIGNING_SECRET
   ```

   Value: any random string of 32+ characters. Make one in a terminal with `openssl rand -hex 32`, or mash the keyboard for 40 characters. Nobody needs to remember it.

7. Click **Deploy** and wait for **Congratulations**.
8. Open the project's **Domains** (Project → **Settings** → **Domains**). The production domain should be:

   ```text
   shepdesign-license-server.vercel.app
   ```

   If Vercel gave it a different name, note it. You'll need it in Part 6, step 2.

9. Open, replacing the domain if yours differs:

   ```text
   https://shepdesign-license-server.vercel.app/api/health
   ```

   You should see `{"ok":true,"creem_mode":"test"}`. If it says `"ok":false`, the `error` names the missing variable. Fix it under **Settings → Environment Variables**, then **Deployments → ⋯ → Redeploy**.

---

## Part 6. Test the whole flow on a staging site

1. Install core 1.6.0+ and Pro 1.4.0+ on a staging site (Local, for example).
2. **Only if** your Vercel domain differs from `shepdesign-license-server.vercel.app`, open the staging site's `wp-config.php` and add this line above `/* That's all, stop editing! */`, with your domain:

   ```php
   define( 'HOF_PRO_LICENSE_SERVER', 'https://your-domain.vercel.app' );
   ```

3. In Creem (still in test mode), open the Pro product and use its **share / checkout link** to buy it.
4. At checkout, the card number is:

   ```text
   4111 1111 1111 1111
   ```

   Any future expiry date, any CVC, any name and address.

5. The confirmation page and the receipt email show the **license key**. Copy it.
6. In the staging site's admin, go to **Hooked on Facets → License**.
7. Paste the key into **License key** and click **Activate**.
8. The screen should show **Active**, `Key …XXXX`, `1 of N sites`, and the renewal date if there is one.
9. Check updates: go to **Dashboard → Updates** and click **Check again**. If a Pro release on GitHub is newer than the installed Pro, it's listed with **Update now**.
10. Click **Deactivate on this site**. The screen goes back to **Not activated**, and the slot is free again in Creem.

If activation fails, the message under the field says why: unknown key, too many sites, expired, or "Couldn't reach the license server". For the last one, re-check `/api/health` from Part 5.

---

## Part 7. Go live

1. In Creem, switch **Test Mode** off.
2. Create the product again in live mode, exactly as in Part 2. Test and live products are separate, and so are their IDs.
3. Copy the **live** product ID (`prod_…`) and the **live** API key (**Developers → API keys**).
4. In Vercel → the project → **Settings → Environment Variables**, change these three:

   | Name | New value |
   |---|---|
   | `CREEM_MODE` | `live` |
   | `CREEM_API_KEY` | the live API key |
   | `CREEM_PRODUCT_HOOKED_ON_FACETS_PRO` | the live product ID |

5. **Deployments → ⋯ → Redeploy**.
6. `/api/health` should now show `"creem_mode":"live"`.
7. Test keys stop working now. Buy once with a real card (refund it afterwards in Creem) to confirm the live flow.
8. Creem reviews a store before live payments. It needs a website on its own domain. See https://docs.creem.io/merchant-of-record/account-reviews/account-reviews

---

## Releasing a Pro update

Nothing to upload anywhere:

1. Bump the version in `hooked-on-facets-pro.php` (both the `Version:` header and `HOF_PRO_VERSION`) and add a `CHANGELOG.md` section.
2. Merge to `main`. The release workflow tests, builds the ZIP and publishes the GitHub release.
3. Licensed sites see the update within about 12 hours, or straight away after **Dashboard → Updates → Check again**.

A version with a hyphen (`1.5.0-beta`) is published as a pre-release. Only sites already running a beta are offered it.

---

## Your values

| Value | Where it comes from | Where it goes |
|---|---|---|
| Product ID `prod_…` (test, then live) | Creem → Products | Vercel `CREEM_PRODUCT_HOOKED_ON_FACETS_PRO` |
| API key (test, then live) | Creem → Developers | Vercel `CREEM_API_KEY` |
| GitHub token | GitHub → Personal access tokens | Vercel `GITHUB_TOKEN` |
| Signing secret | You make it up | Vercel `DOWNLOAD_SIGNING_SECRET` |
| Server domain | Vercel → Domains | Pro's default, or `HOF_PRO_LICENSE_SERVER` in `wp-config.php` |

## Don'ts

- Don't put the Creem API key or the GitHub token in the plugin, `wp-config.php` or the repo. Pro's build fails if a `creem_…` key is in the ZIP.
- Don't mix test and live: a test key only works with `CREEM_MODE=test` and the test product ID.
- Don't rename `hooked-on-facets-pro-<version>.zip` on a release. The server looks for exactly that file.

See [Licensing & Updates](licensing-and-updates.md) for how the pieces fit, and `license-server/README.md` in the Pro repo for the server's endpoints.
