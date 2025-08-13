import GradientBackground from '../components/GradientBackground'
import TextHighlighter from '../components/text-highlighter'

export default function Terms() {
  const lastUpdated = new Date().toLocaleDateString()

  return (
    <GradientBackground>
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-20">
        <header className="text-center">
          <p className="text-sm uppercase tracking-wider text-neutral-400">Terms & Conditions</p>
          <h1 className="mt-2 text-4xl md:text-5xl font-bold tracking-tight text-neutral-100">
            Invoxus — Privacy, Usage, and Legal Notice
          </h1>
          <p className="mt-3 text-neutral-400">Last updated: {lastUpdated}</p>
        </header>

        <div className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-6 md:p-8 text-neutral-200">
          <p className="text-lg leading-8">
            At Invoxus, your trust is paramount. We are committed to maintaining the highest standards of
            <TextHighlighter
              className="mx-1 rounded-[0.3em] px-1 text-black"
              transition={{ type: 'spring', duration: 0.8, delay: 0.1, bounce: 0 }}
              highlightColor="#ffffff"
              useInViewOptions={{ once: true, amount: 0.2 }}
            >
              privacy, transparency, and responsible development
            </TextHighlighter>
            across the product experience.
          </p>

          <div className="mt-8 space-y-8">
            {/* 1. Privacy & Data Security */}
            <section id="privacy" aria-labelledby="privacy-heading">
              <h2 id="privacy-heading" className="text-xl font-semibold text-neutral-100">1. Privacy & Data Security</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-neutral-300">
                <li>
                  <span className="font-medium text-neutral-100">No Data Collection:</span> We do not collect, store, sell, or
                  share your personal email content. Your messages remain entirely within the control of your email provider and
                  your device.
                </li>
                <li>
                  <span className="font-medium text-neutral-100">Local-First Architecture:</span> All email processing is
                  performed locally on your device unless explicitly stated. Authentication tokens are used solely for facilitating
                  secure communication with your email provider and are never shared with third parties.
                </li>
                <li>
                  <span className="font-medium text-neutral-100">Diagnostic Logging:</span> If diagnostic logs are generated,
                  they are minimal and exclude message content and any personally identifiable information (PII). These logs, if
                  used, exist solely to improve app stability and performance.
                </li>
              </ul>
            </section>

            {/* 2. Responsible Usage */}
            <section id="usage" aria-labelledby="usage-heading">
              <h2 id="usage-heading" className="text-xl font-semibold text-neutral-100">2. Responsible Usage</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-neutral-300">
                <li>
                  <span className="font-medium text-neutral-100">Lawful Use:</span> You must use the app in accordance with all
                  applicable local, national, and international laws. Misuse of the software to send unsolicited or harmful
                  communications is strictly prohibited.
                </li>
                <li>
                  <span className="font-medium text-neutral-100">Inbox Respect:</span> We expect users to respect the integrity
                  of both their own inbox and those of recipients. Features such as AI-driven delete suggestions are designed to
                  assist, but are heuristic in nature. Users are responsible for reviewing and confirming suggested actions.
                </li>
                <li>
                  <span className="font-medium text-neutral-100">Personal Accountability:</span> All content decisions—such as
                  deletions, replies, or forwarding—are the responsibility of the user.
                </li>
              </ul>
            </section>

            {/* 3. Limitation of Liability */}
            <section id="liability" aria-labelledby="liability-heading">
              <h2 id="liability-heading" className="text-xl font-semibold text-neutral-100">3. Limitation of Liability</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-neutral-300">
                <li>
                  <span className="font-medium text-neutral-100">No Guarantees:</span> This software is provided "as is",
                  without warranty of any kind, express or implied. While we have taken care to ensure the accuracy and functionality
                  of Invoxus, we cannot guarantee that the software will be error-free, continuously available, or free of minor UI
                  or UX imperfections.
                </li>
                <li>
                  <span className="font-medium text-neutral-100">Liability Disclaimer:</span> Invoxus and its developer(s) accept
                  no liability for any direct, indirect, incidental, or consequential damages, including but not limited to data loss,
                  missed communications, or disruptions in workflow resulting from use of the application.
                </li>
              </ul>
            </section>

            {/* 4. Updates & Policy Changes */}
            <section id="updates" aria-labelledby="updates-heading">
              <h2 id="updates-heading" className="text-xl font-semibold text-neutral-100">4. Updates & Policy Changes</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-neutral-300">
                <li>
                  <span className="font-medium text-neutral-100">Feature Updates:</span> Functionality may change over time to
                  enhance performance, user experience, or security.
                </li>
                <li>
                  <span className="font-medium text-neutral-100">Policy Revisions:</span> Any significant updates to our data,
                  privacy, or usage policies will be reflected on this page. We encourage users to review this document periodically.
                </li>
              </ul>
            </section>

            {/* 5. Contact & Support */}
            <section id="contact" aria-labelledby="contact-heading">
              <h2 id="contact-heading" className="text-xl font-semibold text-neutral-100">5. Contact & Support</h2>
              <p className="mt-3 text-neutral-300">
                Invoxus is a solo-developed initiative, built with care and attention to detail. If you have questions, concerns,
                or constructive feedback, please don’t hesitate to reach out. We strive to respond to inquiries as promptly as
                possible and value your input in helping improve the app. You can contact us at
                {' '}<a className="underline" href="mailto:contact@invoxus.in">contact@invoxus.in</a>.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => { window.location.hash = '' }}
            className="rounded-lg border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-900 px-4 py-2 text-sm text-neutral-100"
          >
            Back to Home
          </button>
        </div>
      </section>
    </GradientBackground>
  )
}

