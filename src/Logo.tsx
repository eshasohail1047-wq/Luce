type LogoProps = {
  /** Pass null when the parent already provides the link. */
  href?: string | null
}

/**
 * LUCE wordmark — Outfit (same family as body/headings), lens orb in U,
 * open three-bar E, soft light accents. Transparent.
 */
export default function Logo({ href = '#top' }: LogoProps) {
  const mark = (
    <>
      <span className="logo-lockup" aria-hidden="true">
        <span className="logo-letters">
          <span className="ch">L</span>
          <span className="ch u">
            U
            <i className="orb">
              <i className="orb-shine" />
            </i>
            <i className="light-rays" />
          </span>
          <span className="ch">C</span>
          <span className="ch e">
            <i />
            <i className="e-beam" />
            <i />
          </span>
        </span>
      </span>
      <span className="sr-only">LUCE</span>
    </>
  )

  if (href === null) {
    return (
      <span className="logo logo-wordmark" aria-label="LUCE">
        {mark}
      </span>
    )
  }

  return (
    <a className="logo logo-wordmark" href={href} aria-label="LUCE home">
      {mark}
    </a>
  )
}
