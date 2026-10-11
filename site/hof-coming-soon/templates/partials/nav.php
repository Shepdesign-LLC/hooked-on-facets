<?php
/** The wordmark, linking home. Expects $home_url. */
defined( 'ABSPATH' ) || exit;
?>
  <a class="nav" href="<?php echo esc_url( $home_url ); ?>">
    <svg viewBox="0 0 72 72" aria-hidden="true"><path d="M36 6 L62 21 L36 36 L10 21 Z" fill="#7F77DD"/><path d="M10 21 L10 51 L36 66 L36 36 Z" fill="#3C3489"/><path d="M62 21 L62 51 L36 66 L36 36 Z" fill="#534AB7"/><circle cx="36" cy="6" r="3.5" fill="#D85A30"/></svg>
    <span>hooked on facets</span>
  </a>
