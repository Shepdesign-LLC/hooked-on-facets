<?php
/**
 * DesignTokens — the CSS variables every HOF surface reads, plus site CSS.
 *
 * Stored in one option, `hof_tokens`, beside each other:
 *   tokens     name => value for the variables the admin edited
 *   custom_css free CSS, sanitized on save
 *   scope      'site' (as written) or 'facet' (every selector prefixed
 *              with .hof-facet--<slug>)
 *   facet      the slug the 'facet' scope targets
 *
 * The front end prints the tokens as an inline block and the custom CSS after
 * it, so a change here restyles every facet on the site with no rebuild.
 *
 * @package HookedOnFacets
 */

declare(strict_types=1);

namespace HookedOnFacets\Design;

defined( 'ABSPATH' ) || exit;

final class DesignTokens {

    public const OPTION = 'hof_tokens';

    /** Upper bound on stored custom CSS. Site CSS this large belongs in a theme. */
    public const MAX_CSS_BYTES = 20000;

    /**
     * Tokens the admin's own UI follows when they are saved: the brand accents
     * only. Surfaces, text and borders stay the admin's own neutrals so a dark
     * or loud storefront palette can never make the settings screens unreadable.
     */
    public const ADMIN_TOKENS = [
        '--hof-primary', '--hof-on-primary', '--hof-danger',
    ];

    /**
     * The brand set, the target of "Reset to brand". Shared with the admin UI
     * through one JSON file so the two can never drift.
     *
     * @return array<string, string>
     */
    public static function brand(): array {
        static $brand = null;
        if ( $brand === null ) {
            $raw   = file_get_contents( __DIR__ . '/brand-tokens.json' );
            $brand = is_string( $raw ) ? (array) json_decode( $raw, true ) : [];
        }
        return $brand;
    }

    /**
     * What the front end uses when nothing has been saved: the brand set for
     * every token it covers, plus the tokens only the stylesheet defines.
     * Colors come from brand() so "Reset to brand" and the front end can never
     * disagree.
     *
     * @return array<string, string>
     */
    public static function defaults(): array {
        $brand = self::brand();

        return [
            // Brand
            '--hof-primary'    => $brand['--hof-primary'],
            '--hof-on-primary' => $brand['--hof-on-primary'],
            '--hof-accent'     => $brand['--hof-danger'], // facet coral; --hof-danger below follows it
            '--hof-surface'    => $brand['--hof-surface'],
            '--hof-bg'         => $brand['--hof-bg'],
            '--hof-border'     => $brand['--hof-border'],
            '--hof-text'       => $brand['--hof-text'],
            '--hof-muted'      => $brand['--hof-muted'],
            '--hof-danger'     => 'var(--hof-accent)',

            // Spacing + radius scale
            '--hof-space'       => '8px',
            '--hof-radius-xs'   => '4px',
            '--hof-radius-sm'   => '6px',
            '--hof-radius-md'   => '8px',
            '--hof-radius-lg'   => '10px',
            '--hof-radius-xl'   => '16px',
            '--hof-radius-pill' => '999px',
            '--hof-radius-ui'   => 'var(--hof-radius-md)',

            // Typography
            '--hof-font-body'         => 'inherit',
            '--hof-font-mono'         => 'ui-monospace, "SF Mono", Menlo, monospace',
            '--hof-font-size-body'    => '0.9375rem',
            '--hof-font-size-sm'      => '0.875rem',
            '--hof-font-size-xs'      => '0.8125rem',
            '--hof-font-size-eyebrow' => '0.6875rem',

            // Facet title: sentence case, the theme's own weight scale.
            '--hof-label-color'          => 'var(--hof-text)',
            '--hof-label-font-size'      => 'var(--hof-font-size-body)',
            '--hof-label-font-weight'    => '600',
            '--hof-label-letter-spacing' => 'normal',
            '--hof-label-transform'      => 'none',

            // Count badge
            '--hof-count-color'       => 'var(--hof-muted)',
            '--hof-count-font-size'   => 'var(--hof-font-size-sm)',
            '--hof-count-font-weight' => '400',

            // Input chrome (range, search, date, dropdown, ask, visual-dna)
            '--hof-input-bg'       => 'var(--hof-surface)',
            '--hof-input-border'   => 'var(--hof-border)',
            '--hof-input-border-w' => '1px',
        ];
    }

    /**
     * The saved option, cleaned, or an empty array when nothing was saved.
     *
     * @return array{tokens: array<string, string>, custom_css: string, scope: string, facet: string}|array{}
     */
    private static function saved(): array {
        $raw = get_option( self::OPTION, [] );
        return is_array( $raw ) && $raw !== [] ? self::sanitize( $raw ) : [];
    }

    /**
     * Only the values the admin saved: what to lay over the defaults.
     *
     * @return array<string, string>
     */
    public static function saved_overrides(): array {
        return self::saved()['tokens'] ?? [];
    }

    /**
     * Everything the Design tokens screen needs: the values in effect now for
     * each editable token, and the site CSS.
     *
     * @return array{tokens: array<string, string>, brand: array<string, string>, custom_css: string, scope: string, facet: string}
     */
    public static function get(): array {
        $saved    = self::saved();
        $defaults = self::defaults();
        $tokens   = [];
        foreach ( array_keys( self::brand() ) as $name ) {
            $tokens[ $name ] = $saved['tokens'][ $name ] ?? $defaults[ $name ] ?? self::brand()[ $name ];
        }

        return [
            'tokens'     => $tokens,
            'brand'      => self::brand(),
            'custom_css' => $saved['custom_css'] ?? '',
            'scope'      => $saved['scope'] ?? 'site',
            'facet'      => $saved['facet'] ?? '',
        ];
    }

    /**
     * Clean a payload from the admin (or the stored option) down to what may
     * be kept.
     *
     * @param array<string, mixed> $raw
     * @return array{tokens: array<string, string>, custom_css: string, scope: string, facet: string}
     */
    public static function sanitize( array $raw ): array {
        $tokens = [];
        foreach ( (array) ( $raw['tokens'] ?? [] ) as $name => $value ) {
            $name = is_string( $name ) ? strtolower( trim( $name ) ) : '';
            if ( ! preg_match( '/^--hof-[a-z0-9-]{1,60}$/', $name ) || ! is_scalar( $value ) ) {
                continue;
            }
            $clean = self::sanitize_value( (string) $value );
            if ( $clean !== '' && count( $tokens ) < 80 ) {
                $tokens[ $name ] = $clean;
            }
        }

        $facet = isset( $raw['facet'] ) ? preg_replace( '/[^a-z0-9_-]/', '', strtolower( (string) $raw['facet'] ) ) : '';

        return [
            'tokens'     => $tokens,
            'custom_css' => self::sanitize_css( isset( $raw['custom_css'] ) ? (string) $raw['custom_css'] : '' ),
            'scope'      => ( $raw['scope'] ?? 'site' ) === 'facet' && $facet !== '' ? 'facet' : 'site',
            'facet'      => (string) $facet,
        ];
    }

    /**
     * @param array<string, mixed> $raw
     */
    public static function save( array $raw ): array {
        update_option( self::OPTION, self::sanitize( $raw ), true );
        return self::get();
    }

    /**
     * A token value is a colour, length, number, font list or var() reference.
     * Anything that could end the declaration or load something is dropped.
     */
    public static function sanitize_value( string $value ): string {
        $value = trim( $value );
        if ( $value === '' || strlen( $value ) > 200 ) {
            return '';
        }
        if ( preg_match( '/[;{}<>\\\\]|url\s*\(|expression\s*\(|javascript:|@import/i', $value ) ) {
            return '';
        }
        return preg_replace( '/[^A-Za-z0-9#%.,()\/\-_ \'"+*]/', '', $value ) ?? '';
    }

    // ── Custom CSS ───────────────────────────────────────────────────────

    /**
     * Site CSS, made safe to store and print. Removes `<` (so nothing can
     * close the style tag), comments, `@import`, `expression(`, script-ish
     * URLs and any `url()` that isn't http(s). A declaration that contains one
     * is dropped whole, so what remains still means what it said. Escapes are
     * decoded before checking, so `\75rl(` can't slip past.
     */
    public static function sanitize_css( string $css ): string {
        $css = str_replace( [ '<', "\0" ], '', $css );
        $css = (string) preg_replace( '#/\*.*?\*/#s', '', $css );
        $css = substr( $css, 0, self::MAX_CSS_BYTES );

        $out   = '';
        $chunk = '';
        $quote = '';
        $paren = 0; // a ';' inside url(data:…;base64,…) doesn't end the declaration
        $len   = strlen( $css );
        for ( $i = 0; $i < $len; $i++ ) {
            $c = $css[ $i ];
            if ( $quote !== '' ) {
                $chunk .= $c;
                if ( $c === '\\' && $i + 1 < $len ) {
                    $chunk .= $css[ ++$i ];
                } elseif ( $c === $quote ) {
                    $quote = '';
                }
                continue;
            }
            if ( $c === '"' || $c === "'" ) {
                $quote  = $c;
                $chunk .= $c;
                continue;
            }
            if ( $c === '\\' && $i + 1 < $len ) {
                $chunk .= $c . $css[ ++$i ];
                continue;
            }
            if ( $c === '(' ) {
                $paren++;
            } elseif ( $c === ')' ) {
                $paren = max( 0, $paren - 1 );
            }
            if ( $paren === 0 && ( $c === '{' || $c === '}' ) ) {
                // A block boundary. What came before it is a selector (or an
                // at-rule prelude) or the last declaration with no semicolon.
                $out  .= $c === '}' && self::is_unsafe( $chunk ) ? '' : $chunk;
                $out  .= $c;
                $chunk = '';
                continue;
            }
            if ( $paren === 0 && $c === ';' ) {
                $out  .= self::is_unsafe( $chunk ) ? '' : $chunk . ';';
                $chunk = '';
                continue;
            }
            $chunk .= $c;
        }
        $out .= self::is_unsafe( $chunk ) ? '' : $chunk;

        return trim( $out );
    }

    /**
     * Whether one declaration (or an @import) must not be kept.
     */
    private static function is_unsafe( string $chunk ): bool {
        if ( trim( $chunk ) === '' ) {
            return false;
        }
        $n = self::normalize( $chunk );

        if ( preg_match( '/@import|expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|data:text\/html/', $n ) ) {
            return true;
        }
        if ( preg_match_all( '/url\(\s*([\'"]?)([^)\'"]*)/', $n, $m ) ) {
            foreach ( $m[2] as $target ) {
                if ( ! preg_match( '#^https?://#', trim( $target ) ) ) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Lowercase, comment-free, escape-decoded, whitespace-collapsed text for
     * checking. Never used for output.
     */
    private static function normalize( string $chunk ): string {
        $chunk = (string) preg_replace_callback(
            '/\\\\([0-9a-fA-F]{1,6})\s?|\\\\(.)/s',
            static function ( array $m ): string {
                if ( isset( $m[2] ) && $m[2] !== '' ) {
                    return $m[2];
                }
                $cp = hexdec( $m[1] );
                return $cp > 0 && $cp < 0x110000 ? mb_chr( (int) $cp, 'UTF-8' ) : '';
            },
            $chunk
        );
        return strtolower( (string) preg_replace( '/\s+/', ' ', $chunk ) );
    }

    /**
     * Prefix every rule's selectors with `.hof-facet--<slug>`, so the CSS only
     * touches one facet. Rules nested in @media, @supports, @layer and
     * @container are prefixed too; @keyframes, @font-face and the like are left
     * alone. A selector that starts with the bare `.hof-facet` class is the
     * facet itself, so it is joined to the prefix rather than nested under it.
     *
     * Only selectors change: everything else is copied through verbatim. The
     * admin's live preview runs the same algorithm in JS (customCss.js); both
     * are tested against tests/fixtures/custom-css.json.
     */
    public static function scope_css( string $css, string $slug ): string {
        $slug = preg_replace( '/[^a-z0-9_-]/', '', strtolower( $slug ) );
        if ( $slug === '' || trim( $css ) === '' ) {
            return $css;
        }
        return self::scope_block( $css, '.hof-facet--' . $slug );
    }

    private static function scope_block( string $css, string $prefix ): string {
        $out   = '';
        $len   = strlen( $css );
        $start = 0; // where the current prelude began
        $quote = '';
        $paren = 0;

        for ( $i = 0; $i < $len; $i++ ) {
            $c = $css[ $i ];
            if ( $quote !== '' ) {
                if ( $c === '\\' ) {
                    $i++;
                } elseif ( $c === $quote ) {
                    $quote = '';
                }
                continue;
            }
            if ( $c === '"' || $c === "'" ) {
                $quote = $c;
                continue;
            }
            if ( $c === '\\' ) {
                $i++;
                continue;
            }
            if ( $c === '(' || $c === '[' ) {
                $paren++;
                continue;
            }
            if ( $c === ')' || $c === ']' ) {
                $paren = max( 0, $paren - 1 );
                continue;
            }
            if ( $paren > 0 ) {
                continue;
            }
            if ( $c === ';' || $c === '}' ) {
                $out  .= substr( $css, $start, $i - $start + 1 );
                $start = $i + 1;
                continue;
            }
            if ( $c !== '{' ) {
                continue;
            }

            $prelude = substr( $css, $start, $i - $start );
            $end     = self::matching_brace( $css, $i );
            $body    = substr( $css, $i + 1, $end - $i - 1 );

            if ( preg_match( '/^\s*@([a-z-]+)/i', $prelude, $m ) ) {
                $recurse = in_array( strtolower( $m[1] ), [ 'media', 'supports', 'layer', 'container' ], true );
                $out    .= $prelude . '{' . ( $recurse ? self::scope_block( $body, $prefix ) : $body ) . '}';
            } else {
                $out .= self::scope_selectors( $prelude, $prefix ) . '{' . $body . '}';
            }

            $i     = $end;
            $start = $end + 1;
        }

        return $out . substr( $css, $start );
    }

    private static function matching_brace( string $css, int $open ): int {
        $depth = 0;
        $quote = '';
        $len   = strlen( $css );
        for ( $i = $open; $i < $len; $i++ ) {
            $c = $css[ $i ];
            if ( $quote !== '' ) {
                if ( $c === '\\' ) {
                    $i++;
                } elseif ( $c === $quote ) {
                    $quote = '';
                }
                continue;
            }
            if ( $c === '"' || $c === "'" ) {
                $quote = $c;
            } elseif ( $c === '\\' ) {
                $i++;
            } elseif ( $c === '{' ) {
                $depth++;
            } elseif ( $c === '}' && --$depth === 0 ) {
                return $i;
            }
        }
        return $len;
    }

    private static function scope_selectors( string $prelude, string $prefix ): string {
        preg_match( '/^\s*/', $prelude, $lead );
        preg_match( '/\s*$/', $prelude, $trail );
        $core = trim( $prelude );
        if ( $core === '' ) {
            return $prelude;
        }

        $parts = [];
        $depth = 0;
        $quote = '';
        $buf   = '';
        for ( $i = 0, $n = strlen( $core ); $i < $n; $i++ ) {
            $c = $core[ $i ];
            if ( $quote !== '' ) {
                $buf .= $c;
                if ( $c === '\\' && $i + 1 < $n ) {
                    $buf .= $core[ ++$i ];
                } elseif ( $c === $quote ) {
                    $quote = '';
                }
                continue;
            }
            if ( $c === '"' || $c === "'" ) {
                $quote = $c;
            } elseif ( $c === '(' || $c === '[' ) {
                $depth++;
            } elseif ( $c === ')' || $c === ']' ) {
                $depth = max( 0, $depth - 1 );
            } elseif ( $c === ',' && $depth === 0 ) {
                $parts[] = trim( $buf );
                $buf     = '';
                continue;
            }
            $buf .= $c;
        }
        $parts[] = trim( $buf );

        $scoped = array_map(
            static fn( string $sel ): string => preg_match( '/^\.hof-facet(?![A-Za-z0-9_-])/', $sel )
                ? $prefix . $sel
                : $prefix . ' ' . $sel,
            array_filter( $parts, static fn( string $p ): bool => $p !== '' )
        );

        return $lead[0] . implode( ', ', $scoped ) . $trail[0];
    }

    // ── Output ───────────────────────────────────────────────────────────

    /**
     * The site CSS as the front end prints it: sanitized again on the way out
     * (the option may have been written by anything) and scoped if asked.
     */
    public static function public_css(): string {
        $saved = self::saved();
        $css   = $saved['custom_css'] ?? '';
        if ( $css === '' ) {
            return '';
        }
        return ( $saved['scope'] ?? 'site' ) === 'facet' && ( $saved['facet'] ?? '' ) !== ''
            ? self::scope_css( $css, $saved['facet'] )
            : $css;
    }
}
