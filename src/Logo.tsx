type LogoProps = {
  href?: string
}

/**
 * LUCE wordmark — Outfit typeface, lens orb in U,
 * open three-bar E, soft light accents. Transparent.
 */
export default function Logo({ href = '#top' }: LogoProps) {
  return (
    <a className="logo logo-wordmark" href={href} aria-label="LUCE home">
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
    </a>
  )
}
