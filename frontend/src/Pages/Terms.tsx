import GradientBackground from '../components/GradientBackground'
import TextHighlighter from '../components/text-highlighter'

export default function Terms() {
  const lastUpdated = new Date().toLocaleDateString()

  return (
    <GradientBackground>
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-20">
        <header className="text-center">
          <p className="text-sm uppercase tracking-wider text-neutral-400">Privacy Policy</p>
          <h1 className="mt-2 text-4xl md:text-5xl font-bold tracking-tight text-neutral-100">
            Invoxus — Privacy & Data Use Notice
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
                  <span className="font-medium text-neutral-100">No Selling or Unrelated Use:</span> We do not sell or use Google user data for advertising or unrelated purposes.
                </li>
                <li>
                  <span className="font-medium text-neutral-100">Data Access & Scope:</span> With your consent, the app accesses Gmail to read, draft, send, and label messages strictly to power product features (e.g., listing messages, drafting replies, smart unsubscribe). We request the minimum scopes needed and use them only for the stated purpose.
                </li>
                <li>
                  <span className="font-medium text-neutral-100">Storage:</span> Session tokens are stored in secure cookies. We may persist tokens in our database to allow background jobs you request (e.g., sending later). We do not store email content unless you explicitly save drafts or categories.
                </li>
                <li>
                  <span className="font-medium text-neutral-100">Sharing:</span> We do not share Google user data with third parties, except service providers strictly necessary to deliver requested features (e.g., infrastructure or job processing) and bound by confidentiality.
                </li>
                <li>
                  <span className="font-medium text-neutral-100">Deletion:</span> You can revoke access at any time in your Google Account. You may request deletion of stored tokens and app data by contacting <a className="underline" href="mailto:contact@invoxus.in">contact@invoxus.in</a>.
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
                  <span className="font-medium text-neutral-100">User Review Required:</span> Features such as smart cleanup and unsubscribe require explicit user confirmation before changes are made.
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

            {/* 3. Updates & Policy Changes */}
            <section id="updates" aria-labelledby="updates-heading">
              <h2 id="updates-heading" className="text-xl font-semibold text-neutral-100">3. Updates & Policy Changes</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-neutral-300">
                <li>
                  <span className="font-medium text-neutral-100">Feature Updates:</span> Functionality may change over time to
                  enhance performance, user experience, or security.
                </li>
                <li>
                  <span className="font-medium text-neutral-100">Policy Revisions & Notices:</span> We will update this page if our data practices change and will notify users in‑product when material changes occur.
                </li>
              </ul>
            </section>

            {/* 4. Contact & Support */}
            <section id="contact" aria-labelledby="contact-heading">
              <h2 id="contact-heading" className="text-xl font-semibold text-neutral-100">4. Contact & Support</h2>
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

