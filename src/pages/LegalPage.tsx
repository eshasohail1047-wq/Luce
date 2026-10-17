import { Link, useLocation } from 'react-router-dom'
import Logo from '../Logo'

const PAGES: Record<
  string,
  { title: string; updated: string; sections: { heading: string; body: string }[] }
> = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'October 2026',
    sections: [
      {
        heading: 'What we collect',
        body: 'Account email, display name, workspace preferences, and the product URLs or photos you upload to create campaigns. We also store campaign metadata needed to run LUCE.',
      },
      {
        heading: 'How we use it',
        body: 'To authenticate you, generate creatives you request, improve product fidelity, and send optional export notifications when you enable them in Settings.',
      },
      {
        heading: 'Sharing',
        body: 'We use trusted processors (for example Firebase Auth, Firestore, and Storage) to operate the product. We do not sell your personal data.',
      },
      {
        heading: 'Contact',
        body: 'Questions about privacy: hello@luce.ai.',
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: 'October 2026',
    sections: [
      {
        heading: 'Using LUCE',
        body: 'You may use LUCE to create marketing assets for products you own or are authorized to promote. You are responsible for the product content you submit and how you publish generated assets.',
      },
      {
        heading: 'Plans',
        body: 'Free includes Image Studio access. Video, ads, and full campaigns require a paid plan. Plan features may change as we ship new capabilities.',
      },
      {
        heading: 'Content ownership',
        body: 'You retain rights to your product materials. Generated assets are licensed to you for marketing use under your active plan.',
      },
      {
        heading: 'Contact',
        body: 'Legal questions: hello@luce.ai.',
      },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    updated: 'October 2026',
    sections: [
      {
        heading: 'Essential cookies',
        body: 'We use essential storage for sign-in session, plan preferences, and carrying your product into Image Studio after Try free.',
      },
      {
        heading: 'Analytics',
        body: 'If analytics are enabled later, they will help us understand product usage. You can request details anytime at hello@luce.ai.',
      },
      {
        heading: 'Control',
        body: 'You can clear site data in your browser. Signing out clears your LUCE session on this device.',
      },
    ],
  },
}

export default function LegalPage() {
  const { pathname } = useLocation()
  const key = pathname.replace(/^\//, '')
  const page = PAGES[key] || PAGES.privacy

  return (
    <div className="legal-page">
      <header className="legal-top">
        <Logo />
        <nav className="legal-nav">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/cookies">Cookies</Link>
          <Link to="/">Back to LUCE</Link>
        </nav>
      </header>
      <main className="legal-main">
        <p className="legal-updated">Updated {page.updated}</p>
        <h1>{page.title}</h1>
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </main>
    </div>
  )
}
