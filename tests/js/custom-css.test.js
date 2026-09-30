import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/custom-css.json';
import { scopeCss } from '../../admin/src/lib/customCss.js';

// The same cases DesignTokensTest runs against the PHP implementation.
describe('scopeCss matches the PHP scope_css fixtures', () => {
    it.each(fixtures.scope)('$name', ({ slug, input, expected }) => {
        expect(scopeCss(input, slug)).toBe(expected);
    });
});
