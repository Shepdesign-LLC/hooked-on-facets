// Button-style checkbox / radio facets.
//
// A button carries a value the way a checked input does: `data-value` and
// `aria-pressed`. Pressing one flips it and yields the same { name, values }
// the checkbox / radio change handler in main.js would produce, so the store,
// the URL (?hof[brand][]=alder) and the request are identical to list style.
//
// Semantics follow the display the server put on the wrapper:
//   checkbox — each press toggles that value.
//   radio    — one value at a time; pressing the selected one clears it.

export const BUTTON_SELECTOR = '.hof-btn[data-value]';

/**
 * Flip the pressed button and report the facet's new value list, or null when
 * the press should be ignored (disabled, or not inside a facet).
 *
 * @param {HTMLElement} btn
 * @returns {{ name: string, values: string[] } | null}
 */
export function pressButton(btn) {
    if (!btn || btn.disabled) return null;
    const facetEl = btn.closest('[data-hof-facet]');
    const name = facetEl?.getAttribute('data-hof-facet');
    if (!facetEl || !name) return null;

    const buttons = Array.from(facetEl.querySelectorAll(BUTTON_SELECTOR));
    const wasPressed = btn.getAttribute('aria-pressed') === 'true';

    if (facetEl.getAttribute('data-hof-display') === 'radio') {
        buttons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    }
    btn.setAttribute('aria-pressed', wasPressed ? 'false' : 'true');

    const values = buttons
        .filter((b) => b.getAttribute('aria-pressed') === 'true')
        .map((b) => b.getAttribute('data-value'));

    return { name, values };
}

/**
 * Bring a live button facet in line with the freshly rendered copy without
 * replacing nodes, so a focused button keeps focus. Updates counts, pressed
 * and disabled state; adds buttons that appeared and drops ones that went
 * (except the focused one, which the next full swap reconciles).
 */
export function patchButtons(current, incoming) {
    const wrap = current.querySelector('.hof-facet__buttons');
    const nextWrap = incoming.querySelector('.hof-facet__buttons');
    if (!wrap || !nextWrap) {
        current.innerHTML = incoming.innerHTML;
        return;
    }

    const focused = document.activeElement;
    const next = new Map(
        Array.from(nextWrap.querySelectorAll(BUTTON_SELECTOR)).map((b) => [b.getAttribute('data-value'), b])
    );

    wrap.querySelectorAll(BUTTON_SELECTOR).forEach((btn) => {
        const value = btn.getAttribute('data-value');
        const fresh = next.get(value);
        if (!fresh) {
            if (btn !== focused) btn.remove();
            return;
        }
        next.delete(value);

        btn.className = fresh.className;
        btn.setAttribute('aria-pressed', fresh.getAttribute('aria-pressed') || 'false');
        if (fresh.disabled) btn.setAttribute('disabled', '');
        else btn.removeAttribute('disabled');

        const count = btn.querySelector('.hof-btn__count');
        const freshCount = fresh.querySelector('.hof-btn__count');
        if (count && freshCount) count.textContent = freshCount.textContent;
    });

    // Buttons the live copy didn't have yet.
    next.forEach((fresh) => wrap.appendChild(fresh.cloneNode(true)));
}
