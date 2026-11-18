# Set up hooked on facets in Freemius

You'll create two products in Freemius:

| Product | Type | Slug (must match exactly) | Paid? |
|---|---|---|---|
| **Hooked on Facets** | WordPress plugin | `hooked-on-facets` | No, it's the free plugin |
| **Hooked on Facets Pro** | **Add-on** of Hooked on Facets | `hooked-on-facets-pro` | Yes, premium only |

At the end you'll have **4 values**: an ID and a public key for each product. Both plugins stay switched off in Freemius until all 4 are set.

Freemius changes its dashboard wording now and then. If a button is named slightly differently from what's written here, look for the closest match. The slugs and settings in the table above are what matter, because the plugin code expects them.

---

## Part 1. Create your Freemius account

1. Go to:

   ```text
   https://dashboard.freemius.com/register/
   ```

2. Sign up with your business email and confirm it from the email Freemius sends.
3. You should land on an empty dashboard with an option to add a product.

---

## Part 2. Create the free plugin product

1. Click **Add Product** (or **+ New Product**).
2. Choose **WordPress** → **Plugin**.
3. **Product name**, paste:

   ```text
   Hooked on Facets
   ```

4. **Slug**, paste exactly:

   ```text
   hooked-on-facets
   ```

5. When asked how it's sold, pick **Free** (or "freemium with add-ons"). Do **not** add paid plans to this product. Pro is sold as its add-on.
6. If asked whether it's on WordPress.org, answer **Yes**. The plugin is set up to be WordPress.org compliant: no tracking until the site owner opts in.
7. Save. You should now be inside the **Hooked on Facets** product's dashboard.

### Copy its two values

1. In the product's left menu, open **Settings** → **Keys**.
2. Copy the **ID** (a number) into the table at the bottom of this file, row 1.
3. Copy the **Public Key** (starts with `pk_`) into row 2.
4. **Don't copy the Secret Key** (starts with `sk_`). It must never go in the plugin or anywhere in the code.

---

## Part 3. Create Pro as an add-on

Pro must be an **add-on of the free plugin**, not a separate standalone product. The code links the two.

1. Still inside the **Hooked on Facets** product, open **Add-Ons** in the left menu.
2. Click **Add Add-On** (or **+ New Add-On**).
3. **Name**, paste:

   ```text
   Hooked on Facets Pro
   ```

4. **Slug**, paste exactly:

   ```text
   hooked-on-facets-pro
   ```

5. Set it as **Premium only**: there is no free version of Pro.
6. Save. You should now be inside the **Hooked on Facets Pro** add-on's dashboard. Its name shows at the top.

### Create its pricing

1. In the add-on's left menu, open **Plans**.
2. Create your paid plan (for example "Pro"). Set:
   - the price for each license size you sell (for example 1 site, 5 sites, 25 sites)
   - yearly and/or lifetime billing
   - a free trial, if you want one. The License screen already shows "trial" status.
3. Save the plan.

### Copy its two values

1. In the add-on's left menu, open **Settings** → **Keys**.
2. Copy the **ID** into row 3 of the table below.
3. Copy the **Public Key** (`pk_…`) into row 4.
4. Again, **don't copy the Secret Key**.

---

## Part 4. Upload the Pro zip

Freemius delivers Pro's downloads and automatic updates, so it needs the zip.

1. In the **Hooked on Facets Pro** add-on, open **Deployment**.
2. Upload the latest Pro release zip. Get it from **Assets** on:

   ```text
   https://github.com/Shepdesign-LLC/hooked-on-facets-pro/releases/latest
   ```

   Download it with a **right-click → Download Linked File** (Safari) or **Save Link As…** (Chrome), so it stays a `.zip` file.
3. After it processes, set that version to **Released**.

Freemius also needs the free plugin's zip if you'll sell or deliver it through Freemius. For a free plugin that lives on WordPress.org, Freemius reads it from there.

---

## Part 5. Your 4 values

Fill this in as you go. Public keys and IDs are safe to share and safe to put in code. Secret keys are not.

| # | Setting name | Where it comes from | Value |
|---|---|---|---|
| 1 | `HOF_FS_PRODUCT_ID` | Hooked on Facets → Settings → Keys → **ID** | |
| 2 | `HOF_FS_PUBLIC_KEY` | Hooked on Facets → Settings → Keys → **Public Key** (`pk_…`) | |
| 3 | `HOF_PRO_FS_PRODUCT_ID` | Hooked on Facets Pro → Settings → Keys → **ID** | |
| 4 | `HOF_PRO_FS_PUBLIC_KEY` | Hooked on Facets Pro → Settings → Keys → **Public Key** (`pk_…`) | |

---

## Part 6. Where the values go

**For customers' sites**, the 4 values have to be built into the plugins themselves, because customers won't edit their `wp-config.php`. Right now both plugins ship with them empty. Send the 4 values to Claude and ask it to add them to both repos. That's a small code change in:

- `hooked-on-facets/includes/freemius.php` (values 1 and 2)
- `hooked-on-facets-pro/includes/freemius.php` (values 3 and 4)

Then cut new releases of both plugins.

**To test on your own local site first**, you can set them in its `wp-config.php` without waiting for a release:

1. Open:

   ```text
   /Users/shepdog/Local Sites/hooked-on-facets/app/public/wp-config.php
   ```

   in TextEdit.
2. Directly **above** the line `/* That's all, stop editing! Happy publishing. */`, paste these 4 lines, replacing each `PASTE_…` with your value from the table:

   ```text
   define( 'HOF_FS_PRODUCT_ID', 'PASTE_VALUE_1' );
   define( 'HOF_FS_PUBLIC_KEY', 'PASTE_VALUE_2' );
   define( 'HOF_PRO_FS_PRODUCT_ID', 'PASTE_VALUE_3' );
   define( 'HOF_PRO_FS_PUBLIC_KEY', 'PASTE_VALUE_4' );
   ```

3. Save with **⌘ + S**.
4. Your local site must be on **core 1.4.0 or newer** and **Pro 1.3.0 or newer** for this to work. It's on 1.2.0-beta now, so update both first.
5. Load the WordPress admin. You should see Freemius' opt-in screen for Hooked on Facets. Opt in or skip, either works.
6. Open **hooked on facets → License**. It should now show the Freemius license status, with links to activate or buy, instead of "isn't connected to Freemius yet".

You can delete the old `HOF_LICENSE_DEV_MODE` line from that file. It did nothing after Pro 1.3.0.

---

## Don'ts

- **Never** put a secret key (`sk_…`) in `wp-config.php`, the plugin code or a message. Pro's release build refuses to package a file containing one.
- Don't change the slugs. `hooked-on-facets` and `hooked-on-facets-pro` are what the code expects.
- Don't create Pro as a separate product. It has to be an add-on of Hooked on Facets.
