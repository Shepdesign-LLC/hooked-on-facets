<?php
/**
 * The stand-in homepage. Self-contained: inline CSS and JS, no external requests.
 * Expects $endpoint_url (the REST subscribe route).
 */
defined( 'ABSPATH' ) || exit;
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>hooked on facets — filtering, finally fun.</title>
<meta name="description" content="Faceted search and filtering for WordPress and WooCommerce, built for motion. Join the beta.">
<style>
:root{
  --purple:#534AB7;--purple-700:#3C3489;--purple-400:#7F77DD;--purple-50:#EEEDFE;--purple-200:#CECBF6;
  --coral:#D85A30;--coral-50:#FAECE7;--ink:#2C2C2A;--ink-700:#5F5E5A;--ink-500:#888780;--ink-200:#D3D1C7;
  --cream:#F1EFE8;--canvas:#E6E3D9;--white:#fff;--dark:#1A1A19;
  --r-sm:6px;--r-md:8px;--r-lg:14px;--r-pill:999px;
  --sans:'Geist',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;
  --mono:'Geist Mono','SF Mono',Menlo,Consolas,monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--sans);background:var(--canvas);color:var(--ink);min-height:100vh;padding:clamp(16px,4vw,48px);-webkit-font-smoothing:antialiased}
.wrap{max-width:1100px;margin:0 auto}
.nav{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.nav svg{width:34px;height:34px}.nav span{font-size:17px;font-weight:500;letter-spacing:-.01em}
.grid{display:grid;gap:14px;grid-template-columns:repeat(12,1fr);grid-auto-rows:minmax(120px,auto)}
.tile{background:var(--cream);border-radius:var(--r-lg);padding:clamp(22px,3vw,36px);border:1px solid var(--ink-200)}
.hero{grid-column:span 8;grid-row:span 2;display:flex;flex-direction:column;justify-content:center}
.eyebrow{font-family:var(--mono);font-size:12px;font-weight:500;color:var(--coral);letter-spacing:.14em;text-transform:uppercase;margin-bottom:16px}
h1{font-size:clamp(44px,7vw,76px);font-weight:500;letter-spacing:-.035em;line-height:.98;margin-bottom:20px}
.sub{font-size:18px;line-height:1.55;color:var(--ink-700);max-width:540px}
.signup{grid-column:span 4;grid-row:span 2;background:var(--purple);color:var(--purple-50);border-color:var(--purple-700);display:flex;flex-direction:column;justify-content:center}
.signup h2{font-size:24px;font-weight:500;letter-spacing:-.02em;margin-bottom:8px;color:#fff}
.signup p{font-size:14px;line-height:1.5;color:var(--purple-200);margin-bottom:20px}
form{display:flex;flex-direction:column;gap:14px}
.field{display:flex;flex-direction:column;gap:6px}
label{font-size:12px;font-weight:500;color:var(--purple-200);letter-spacing:.02em}
label small{font-weight:400;opacity:.8}
input[type=email],input[type=text].in{font:inherit;font-size:15px;padding:12px 14px;border-radius:var(--r-md);border:1px solid var(--purple-400);background:#fff;color:var(--ink);width:100%}
input[type=email]:focus,input[type=text].in:focus{outline:2px solid var(--coral);outline-offset:2px}
.hp{position:absolute;left:-9999px;height:0;overflow:hidden}
button{font:inherit;font-size:15px;font-weight:500;padding:13px 18px;border:0;border-radius:var(--r-md);background:var(--coral);color:#fff;cursor:pointer}
button:hover{filter:brightness(1.07)}button[disabled]{opacity:.6;cursor:wait}
.msg{font-size:13px;min-height:1.4em;color:var(--purple-200)}.msg.err{color:#FAD0C2}.msg.ok{color:#fff;font-weight:500}
.fine{font-family:var(--mono);font-size:11px;color:var(--purple-200);margin-top:12px}
.feat{grid-column:span 4}
.feat b{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--purple);margin-bottom:10px}
.feat h3{font-size:20px;font-weight:500;letter-spacing:-.015em;margin-bottom:6px}
.feat p{font-size:14px;line-height:1.5;color:var(--ink-700)}
.builders{grid-column:span 12;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--white)}
.builders .k{font-family:var(--mono);font-size:11px;color:var(--ink-500);text-transform:uppercase;letter-spacing:.1em;margin-right:6px}
.pill{font-size:12px;color:var(--ink-700);padding:5px 12px;border:1px solid var(--ink-200);border-radius:var(--r-pill);background:var(--cream)}
.tile{min-width:0}
@media(max-width:860px){.grid{grid-template-columns:minmax(0,1fr)}.hero,.signup,.feat,.builders{grid-column:auto;grid-row:auto}}
</style>
</head>
<body>
<main class="wrap">
  <div class="nav">
    <svg viewBox="0 0 72 72" role="img" aria-label="hooked on facets"><path d="M36 6 L62 21 L36 36 L10 21 Z" fill="#7F77DD"/><path d="M10 21 L10 51 L36 66 L36 36 Z" fill="#3C3489"/><path d="M62 21 L62 51 L36 66 L36 36 Z" fill="#534AB7"/><circle cx="36" cy="6" r="3.5" fill="#D85A30"/></svg>
    <span>hooked on facets</span>
  </div>

  <div class="grid">
    <section class="tile hero">
      <p class="eyebrow">The new filter standard</p>
      <h1>Filtering,<br>finally fun.</h1>
      <p class="sub">WordPress filters built for motion. Auto-hooks any builder. Indexes 100k+ products in milliseconds and designs itself into your theme.</p>
    </section>

    <section class="tile signup" aria-labelledby="join">
      <h2 id="join">Get hooked early</h2>
      <p>Join the beta. One email when it opens, nothing else.</p>
      <form id="hof-soon-form" method="post" action="<?php echo esc_url( $endpoint_url ); ?>" novalidate>
        <div class="field">
          <label for="hof-name">First name <small>(optional)</small></label>
          <input id="hof-name" class="in" type="text" name="first_name" placeholder="Ada" autocomplete="given-name" maxlength="60">
        </div>
        <div class="field">
          <label for="hof-email">Email</label>
          <input id="hof-email" type="email" name="email" placeholder="you@yourstore.com" autocomplete="email" required>
        </div>
        <input class="hp" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button type="submit">Join the beta</button>
        <div class="msg" role="status" aria-live="polite"></div>
      </form>
      <p class="fine">No spam. Unsubscribe anytime.</p>
    </section>

    <section class="tile feat"><b>Speed</b><h3>Sub-50ms queries</h3><p>A purpose-built index, so filters answer before you notice.</p></section>
    <section class="tile feat"><b>Fit</b><h3>Designs itself into your theme</h3><p>Brand tokens in, matching facets out. No CSS fights.</p></section>
    <section class="tile feat"><b>Reach</b><h3>Auto-hooks your builder</h3><p>Drop in and it finds your query loop. No shortcode archaeology.</p></section>

    <section class="tile builders" aria-label="Works with">
      <span class="k">Auto-hooks</span>
      <span class="pill">Bricks</span><span class="pill">Elementor</span><span class="pill">Breakdance</span>
      <span class="pill">Oxygen</span><span class="pill">Gutenberg</span><span class="pill">WooCommerce</span>
    </section>
  </div>
</main>
<script>
(function(){
  var f=document.getElementById('hof-soon-form'),m=f.querySelector('.msg'),b=f.querySelector('button');
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var email=f.elements.email.value.trim();
    if(!/^\S+@\S+\.\S+$/.test(email)){m.className='msg err';m.textContent="That email doesn't look right.";return;}
    b.disabled=true;m.className='msg';m.textContent='Hooking you in…';
    var data=new URLSearchParams(new FormData(f));
    fetch(f.action,{method:'POST',headers:{'Accept':'application/json'},body:data})
      .then(function(r){return r.json().then(function(j){return{ok:r.ok&&j.ok,j:j};});})
      .then(function(x){
        if(x.ok){f.reset();m.className='msg ok';m.textContent="You're in. Watch your inbox.";}
        else{m.className='msg err';m.textContent=(x.j&&x.j.message)||'Something broke. Try again.';b.disabled=false;}
      })
      .catch(function(){m.className='msg err';m.textContent='Network hiccup. Try again.';b.disabled=false;});
  });
})();
</script>
</body>
</html>
