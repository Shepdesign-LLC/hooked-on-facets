<?php
/** Site footer. Expects $privacy_url. */
defined( 'ABSPATH' ) || exit;
?>
  <footer class="foot">
    <span>&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> Shepdesign, LLC</span>
    <a href="<?php echo esc_url( $privacy_url ); ?>">Privacy policy</a>
  </footer>
