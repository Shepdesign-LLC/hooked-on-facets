<?php
/**
 * The privacy policy, served at /privacy/. Self-contained like the homepage.
 * Expects $home_url, $privacy_url and $contact_email.
 *
 * Covers hookedonfacets.com, the free plugin and the Pro add-on. Update it, and
 * $updated, whenever what we collect or who we share it with changes.
 */
defined( 'ABSPATH' ) || exit;

$updated = '2026-10-09';

$mail = static fn( string $label = '' ): string => sprintf(
	'<a href="mailto:%1$s">%2$s</a>',
	esc_attr( $contact_email ),
	esc_html( '' !== $label ? $label : $contact_email )
);
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>Privacy policy — hooked on facets</title>
<meta name="description" content="What hooked on facets, the plugin and hookedonfacets.com collect, why, who sees it, and how to get it deleted.">
<link rel="canonical" href="<?php echo esc_url( $privacy_url ); ?>">
<style>
<?php readfile( __DIR__ . '/partials/base.css' ); ?>
.wrap{max-width:760px}
.head{background:var(--cream);border:1px solid var(--ink-200);border-radius:var(--r-lg);padding:clamp(22px,4vw,44px);margin-bottom:14px}
.eyebrow{font-family:var(--mono);font-size:12px;font-weight:500;color:var(--coral);letter-spacing:.14em;text-transform:uppercase;margin-bottom:14px}
h1{font-size:clamp(36px,6vw,56px);font-weight:500;letter-spacing:-.035em;line-height:1;margin-bottom:16px}
.lede{font-size:17px;line-height:1.6;color:var(--ink-700)}
.updated{display:inline-block;margin-top:18px;font-family:var(--mono);font-size:11px;color:var(--ink-500);letter-spacing:.06em;text-transform:uppercase}
.tldr{background:var(--purple);color:var(--purple-50);border:1px solid var(--purple-700);border-radius:var(--r-lg);padding:clamp(22px,3vw,32px);margin-bottom:14px}
.tldr h2{color:#fff;font-size:20px;margin:0 0 12px}
.tldr li{color:var(--purple-50)}
.tldr li::marker{color:var(--coral)}
.toc{background:var(--white);border:1px solid var(--ink-200);border-radius:var(--r-lg);padding:18px 22px;margin-bottom:14px}
.toc b{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-500);margin-bottom:10px}
.toc ol{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0;margin:0}
.toc a{display:inline-block;font-size:13px;color:var(--ink-700);text-decoration:none;padding:5px 12px;border:1px solid var(--ink-200);border-radius:var(--r-pill);background:var(--cream)}
.toc a:hover{border-color:var(--purple-400);color:var(--purple)}
.body{background:var(--cream);border:1px solid var(--ink-200);border-radius:var(--r-lg);padding:clamp(22px,4vw,44px)}
section+section{margin-top:36px;padding-top:32px;border-top:1px solid var(--ink-200)}
section{scroll-margin-top:24px}
h2{font-size:24px;font-weight:500;letter-spacing:-.02em;margin-bottom:12px}
h3{font-size:16px;font-weight:600;margin:20px 0 6px}
p,li{font-size:15px;line-height:1.65;color:var(--ink-700)}
p+p,p+ul,ul+p{margin-top:10px}
ul{padding-left:20px}li+li{margin-top:6px}
li::marker{color:var(--purple-400)}
strong{color:var(--ink);font-weight:600}
code{font-family:var(--mono);font-size:.88em;background:var(--white);border:1px solid var(--ink-200);border-radius:4px;padding:1px 5px}
.body a{color:var(--purple);text-underline-offset:3px}
.body a:hover{color:var(--purple-700)}
.table{overflow-x:auto;margin-top:12px;border:1px solid var(--ink-200);border-radius:var(--r-md);background:var(--white)}
table{width:100%;border-collapse:collapse;font-size:14px;min-width:560px}
th,td{text-align:left;vertical-align:top;padding:10px 14px;border-bottom:1px solid var(--ink-200);line-height:1.5;color:var(--ink-700)}
th{font-family:var(--mono);font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-500);background:var(--cream)}
tr:last-child td{border-bottom:0}
td:first-child{color:var(--ink);font-weight:500;white-space:nowrap}
</style>
</head>
<body>
<main class="wrap">
<?php require __DIR__ . '/partials/nav.php'; ?>

    <header class="head">
      <p class="eyebrow">Privacy policy</p>
      <h1>Your data, plainly.</h1>
      <p class="lede">hooked on facets is made by Shepdesign, LLC. We collect as little as we can, we tell you exactly what it is, and we don't sell any of it. Here's the whole picture: this website, the free plugin and hooked on facets Pro.</p>
      <time class="updated" datetime="<?php echo esc_attr( $updated ); ?>">Last updated <?php echo esc_html( gmdate( 'F j, Y', (int) strtotime( $updated ) ) ); ?></time>
    </header>

    <aside class="tldr" aria-labelledby="tldr">
      <h2 id="tldr">The short version</h2>
      <ul>
        <li>Filtering runs on your server. Your shoppers' searches and filter clicks never reach us.</li>
        <li>The plugin sends nothing anywhere unless you opt in to usage data.</li>
        <li>The beta form takes your email and, if you like, a first name. We use them to tell you when the beta opens. That's it.</li>
        <li>No ads, no tracking pixels, no analytics, no visitor cookies on this site. We never sell or rent your data.</li>
      </ul>
    </aside>

    <nav class="toc" aria-label="On this page">
      <b>On this page</b>
      <ol>
        <li><a href="#who">Who we are</a></li>
        <li><a href="#website">This website</a></li>
        <li><a href="#plugin">The plugin</a></li>
        <li><a href="#pro">Pro</a></li>
        <li><a href="#sharing">Who else sees it</a></li>
        <li><a href="#retention">How long we keep it</a></li>
        <li><a href="#basis">Why we're allowed to</a></li>
        <li><a href="#rights">Your rights</a></li>
        <li><a href="#transfers">Where it lives</a></li>
        <li><a href="#security">Security</a></li>
        <li><a href="#kids">Kids</a></li>
        <li><a href="#changes">Changes</a></li>
        <li><a href="#contact">Contact</a></li>
      </ol>
    </nav>

    <article class="body">
      <section id="who">
        <h2>Who we are</h2>
        <p>Shepdesign, LLC ("we", "us") makes the hooked on facets WordPress plugin and the hooked on facets Pro add-on, and runs hookedonfacets.com. For the personal data described here, we're the controller: we decide what's collected and why.</p>
        <p>Questions, requests or complaints go to <?php echo $mail(); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped in $mail ?>.</p>
      </section>

      <section id="website">
        <h2>This website</h2>
        <h3>The beta sign-up</h3>
        <p>The form asks for your <strong>email</strong> (required) and <strong>first name</strong> (optional). We send them to Bento, our email provider, so we can tell you when the beta opens. We won't use them for anything else without asking first. If Bento can't be reached, we hold your sign-up in our WordPress database and retry every hour. Once it goes through, our copy is deleted.</p>
        <h3>Spam protection</h3>
        <p>To stop bots hammering the form, we count sign-up attempts per visitor using a one-way hash of your IP address. The hash expires after 10 minutes. The form also has a hidden field that only bots fill in.</p>
        <h3>Server logs</h3>
        <p>Like every website, our host records basic request logs (IP address, browser, page requested, time) to keep the site running and secure. They're kept for a limited time and never used to profile you.</p>
        <h3>Cookies and tracking</h3>
        <p>None for visitors. This site runs no analytics, loads no fonts or scripts from other sites, and sets no cookies unless you're one of our own admins logging in to WordPress.</p>
      </section>

      <section id="plugin">
        <h2>The plugin</h2>
        <h3>Filtering stays on your server</h3>
        <p>The facet index, your settings and every filter query live in your own WordPress database. Nothing about your products, orders, customers or shoppers is sent to us.</p>
        <h3>The saved bin facet</h3>
        <p>If you use it, items a shopper saves are kept in their own browser (<code>localStorage</code>). They never leave the shopper's device.</p>
        <h3>Usage data, only if you opt in</h3>
        <p>When you activate the plugin, it asks whether you'd like to share usage data through Freemius, our licensing and analytics provider. Skip it and nothing is sent. If you opt in, Freemius receives:</p>
        <ul>
          <li>the name and email of the WordPress user who opted in,</li>
          <li>your site URL and language, and your WordPress, PHP and plugin versions,</li>
          <li>plugin events: activation, deactivation, uninstall and update,</li>
          <li>a list of your active plugins and theme, unless you switch that off on the opt-in screen.</li>
        </ul>
        <p>We use it to fix bugs, decide which builders and themes to test against, and occasionally email you about important updates. You can opt out at any time from the plugin's entry on your Plugins screen.</p>
        <h3>The Add-Ons screen</h3>
        <p>Opening it loads the add-on list from Freemius, which sees that request the way any web server would.</p>
      </section>

      <section id="pro">
        <h2>hooked on facets Pro</h2>
        <h3>Buying and licensing</h3>
        <p>Checkout, payments, licenses, renewals and updates for Pro are handled by Freemius, which acts as our reseller and payment processor. Freemius collects your billing name, email, address and payment details. We receive your name, email, plan and license details so we can support you. We never see your full card number.</p>
        <p>Pro checks your license with Freemius to deliver updates, which sends your site URL and license key.</p>
        <h3>The AI "ask" facet</h3>
        <p>The ask facet uses <strong>your own</strong> Anthropic API key. When a shopper types a question, the plugin sends that text plus your facet setup (facet names and their options) from your server straight to Anthropic. It doesn't pass through us, and we never see it. Because you run it, you're the controller for that data, so mention it in your store's privacy policy. Anthropic's terms and <a href="https://www.anthropic.com/legal/privacy" rel="noopener">privacy policy</a> apply.</p>
      </section>

      <section id="sharing">
        <h2>Who else sees it</h2>
        <p>Only the services we need to run hooked on facets, each under contract to protect it:</p>
        <div class="table">
          <table>
            <thead><tr><th>Service</th><th>What for</th><th>What they get</th></tr></thead>
            <tbody>
              <tr><td><a href="https://bentonow.com" rel="noopener">Bento</a></td><td>The beta email</td><td>Email, first name, sign-up tag, whether you open or click our emails</td></tr>
              <tr><td><a href="https://freemius.com/privacy/" rel="noopener">Freemius</a></td><td>Opt-in usage data, Pro checkout, licensing, updates</td><td>What's listed under <a href="#plugin">The plugin</a> and <a href="#pro">Pro</a></td></tr>
              <tr><td>Our web host</td><td>Serving this website</td><td>Server logs and the sign-up retry queue</td></tr>
            </tbody>
          </table>
        </div>
        <p>We'll also disclose data if the law requires it. If Shepdesign, LLC or hooked on facets is ever sold, your data goes with it under this same policy, and we'll tell you first. We don't sell your data, and we don't share it for advertising.</p>
      </section>

      <section id="retention">
        <h2>How long we keep it</h2>
        <ul>
          <li><strong>Beta sign-ups:</strong> until you unsubscribe or ask us to delete them.</li>
          <li><strong>Sign-ups waiting to reach Bento:</strong> only until they arrive.</li>
          <li><strong>The IP hash:</strong> 10 minutes.</li>
          <li><strong>Usage data:</strong> while you're opted in, and deleted on request.</li>
          <li><strong>Purchase records:</strong> as long as tax and accounting law requires.</li>
        </ul>
      </section>

      <section id="basis">
        <h2>Why we're allowed to</h2>
        <p>If you're in the EU or UK, here's our legal basis under the GDPR:</p>
        <ul>
          <li><strong>Consent</strong> for the beta sign-up and the plugin's usage data. Withdraw it any time.</li>
          <li><strong>Contract</strong> for selling, licensing and supporting Pro.</li>
          <li><strong>Legitimate interests</strong> for keeping the site secure and free of spam.</li>
          <li><strong>Legal obligation</strong> for tax and accounting records.</li>
        </ul>
      </section>

      <section id="rights">
        <h2>Your rights</h2>
        <p>Wherever you live, you can ask us to:</p>
        <ul>
          <li>show you the data we hold about you,</li>
          <li>correct it,</li>
          <li>delete it,</li>
          <li>send you a copy you can take elsewhere,</li>
          <li>stop or limit how we use it.</li>
        </ul>
        <p>Every email we send has an unsubscribe link. For everything else, email <?php echo $mail(); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped in $mail ?>. We'll reply within 30 days and won't treat you differently for asking.</p>
        <p>California residents: we don't sell or share personal information, as the CCPA defines those terms. EU and UK residents can also complain to their local data protection authority, though we'd like the chance to fix it first.</p>
      </section>

      <section id="transfers">
        <h2>Where it lives</h2>
        <p>Shepdesign, LLC is a US company, and our providers may process data in the US and other countries. When data leaves the EU or UK, we rely on our providers' Standard Contractual Clauses or an equivalent safeguard.</p>
      </section>

      <section id="security">
        <h2>Security</h2>
        <p>Everything travels over HTTPS, keys live in server config rather than code, and we collect as little as we can, because data we don't have can't leak. No system is perfect. If a breach affects your data, we'll tell you promptly.</p>
        <p>Found a security issue in the plugin? See our <a href="https://github.com/Shepdesign-LLC/hooked-on-facets/security/policy" rel="noopener">security policy</a>.</p>
      </section>

      <section id="kids">
        <h2>Kids</h2>
        <p>hooked on facets is a tool for people who run websites. It isn't aimed at children under 16, and we don't knowingly collect their data. If you think we have, email us and we'll delete it.</p>
      </section>

      <section id="changes">
        <h2>Changes</h2>
        <p>When this policy changes, we'll update the date at the top. If a change is significant, we'll email the people it affects before it takes effect.</p>
      </section>

      <section id="contact">
        <h2>Contact</h2>
        <p>Shepdesign, LLC<br><?php echo $mail(); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped in $mail ?></p>
      </section>
    </article>

<?php require __DIR__ . '/partials/footer.php'; ?>
</main>
</body>
</html>
