'use client'

import Link from 'next/link'
import { Music, ArrowLeft } from 'lucide-react'

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-300">
      <header className="border-b border-gray-900">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="h-8 w-8 bg-orange-500 rounded-full flex items-center justify-center">
              <Music className="h-4 w-4 text-white" />
            </span>
            <span className="font-bold text-white tracking-tight">ProTouring</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Zurück
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Impressum</h1>

        <section className="space-y-2 mb-8">
          <h2 className="text-lg font-semibold text-white">Angaben gemäß § 5 DDG</h2>
          <p>
            Fabian Zimmermann<br />
            FZ Development<br />
            Waldstraße 106<br />
            56626 Andernach
          </p>
        </section>

        <section className="space-y-2 mb-8">
          <h2 className="text-lg font-semibold text-white">Kontakt</h2>
          <p>E-Mail: <a href="mailto:info@fabian-zimmermann.de" className="text-orange-400 hover:text-orange-300">info@fabian-zimmermann.de</a></p>
        </section>

        <section className="space-y-2 mb-8">
          <h2 className="text-lg font-semibold text-white">Umsatzsteuer-Identifikationsnummer</h2>
          <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:<br />DE213943513</p>
        </section>

        <section className="space-y-2 mb-8">
          <h2 className="text-lg font-semibold text-white">Redaktionell verantwortlich (§ 18 Abs. 2 MStV)</h2>
          <p>Fabian Zimmermann<br />Anschrift wie oben</p>
        </section>

        <section className="space-y-2 mb-8">
          <h2 className="text-lg font-semibold text-white">Verbraucherstreitbeilegung</h2>
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
          <p className="text-sm text-gray-500">
            Hinweis: Die EU-Plattform zur Online-Streitbeilegung (OS) wurde zum 20. Juli 2025 eingestellt.
          </p>
        </section>

        <section className="space-y-2 mb-8">
          <h2 className="text-lg font-semibold text-white">Haftung für Inhalte</h2>
          <p className="leading-relaxed">
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den
            allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht
            verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen
            zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder
            Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine
            diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung
            möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend
            entfernen.
          </p>
        </section>

        <section className="space-y-2 mb-8">
          <h2 className="text-lg font-semibold text-white">Haftung für Links</h2>
          <p className="leading-relaxed">
            Unser Angebot enthält gegebenenfalls Links zu externen Websites Dritter, auf deren Inhalte wir keinen
            Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die
            Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten
            verantwortlich. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
          </p>
        </section>

        <section className="space-y-2 mb-8">
          <h2 className="text-lg font-semibold text-white">Urheberrecht</h2>
          <p className="leading-relaxed">
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
            Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
            Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
          </p>
        </section>

        <p className="text-sm text-gray-600 mt-12">Stand: Juni 2026</p>
      </main>

      <footer className="border-t border-gray-900">
        <div className="max-w-3xl mx-auto px-5 py-6 flex items-center justify-between text-sm text-gray-500">
          <span>© {new Date().getFullYear()} FZ Development</span>
          <div className="flex gap-5">
            <Link href="/datenschutz" className="hover:text-white">Datenschutz</Link>
            <Link href="/" className="hover:text-white">Startseite</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
