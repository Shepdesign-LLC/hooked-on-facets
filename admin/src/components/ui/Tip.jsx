// The "?" affordance: a small round button that reveals help text on hover
// and keyboard focus. Pure CSS (see .hof-tip); the text also goes to
// assistive tech through aria-label.
export default function Tip({ text, align = 'center' }) {
    return (
        <span
            className={`hof-tip ${align === 'left' ? 'hof-tip-left' : ''}`}
            tabIndex={0}
            role="img"
            aria-label={text}
            data-tip={text}
        >
            ?
        </span>
    );
}
