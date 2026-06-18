'use client'

import Link from 'next/link'
import { Music, ArrowLeft } from 'lucide-react'

export default function DatenschutzPage() {
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

      <main className="max-w-3xl mx-auto px-5 py-12 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-8 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:text-gray-100 [&_h3]:mt-5 [&_h3]:mb-1.5 [&_p]:leading-relaxed [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:mb-2 [&_a]:text-orange-400 hover:[&_a]:text-orange-300">
        <h1 className="text-3xl font-bold text-white mb-2">Datenschutzerklärung</h1>
        <p className="text-sm text-gray-500">Diese Erklärung gilt für die Website und die Anwendung unter protouring.de.</p>

        <h2>1. Verantwortlicher</h2>
        <p>
          Verantwortlich für die Datenverarbeitung auf dieser Website und in der Anwendung ist:
        </p>
        <p>
          Fabian Zimmermann · FZ Development<br />
          Waldstraße 106, 56626 Andernach<br />
          E-Mail: <a href="mailto:info@fabian-zimmermann.de">info@fabian-zimmermann.de</a>
        </p>
        <p>Ein Datenschutzbeauftragter ist gesetzlich nicht bestellt.</p>

        <h2>2. Allgemeines zur Datenverarbeitung</h2>
        <p>
          Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung einer funktionsfähigen
          Website und Anwendung sowie unserer Inhalte und Leistungen erforderlich ist. Rechtsgrundlagen sind
          insbesondere Art. 6 Abs. 1 lit. b DSGVO (Vertrag), lit. f DSGVO (berechtigtes Interesse) und – soweit
          eingeholt – lit. a DSGVO (Einwilligung).
        </p>

        <h2>3. Hosting</h2>
        <p>
          Die Website und Anwendung werden bei der Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen,
          Deutschland, gehostet. Die Server stehen in Deutschland. Mit dem Anbieter besteht ein Vertrag zur
          Auftragsverarbeitung (Art. 28 DSGVO). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (sicherer,
          stabiler Betrieb).
        </p>

        <h2>4. Server-Logfiles</h2>
        <p>
          Beim Aufruf der Website werden automatisch Informationen erhoben, die Ihr Browser übermittelt
          (Server-Logfiles): u. a. IP-Adresse, Datum und Uhrzeit der Anfrage, aufgerufene Seite, Referrer,
          Browsertyp und Betriebssystem. Diese Daten dienen dem sicheren Betrieb sowie der Fehleranalyse und
          werden nicht mit anderen Datenquellen zusammengeführt. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
        </p>

        <h2>5. SSL-/TLS-Verschlüsselung</h2>
        <p>
          Diese Seite nutzt aus Sicherheitsgründen eine TLS-Verschlüsselung. Eine verschlüsselte Verbindung
          erkennen Sie am „https://" in der Adresszeile Ihres Browsers.
        </p>

        <h2>6. Kontaktaufnahme</h2>
        <p>
          Wenn Sie uns per E-Mail kontaktieren, werden Ihre Angaben zur Bearbeitung der Anfrage und für mögliche
          Anschlussfragen gespeichert. Rechtsgrundlage: Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO.
        </p>

        <h2>7. Registrierung und Nutzerkonto</h2>
        <p>
          Für die Nutzung der Anwendung ist ein Nutzerkonto erforderlich. Dabei verarbeiten wir die von Ihnen
          angegebenen Daten (insbesondere Name, E-Mail-Adresse, verschlüsselt gespeichertes Passwort) sowie die
          Daten, die Sie im Rahmen der Tour- und Produktionsverwaltung eingeben. Rechtsgrundlage: Art. 6 Abs. 1
          lit. b DSGVO (Erfüllung des Nutzungsvertrags).
        </p>
        <h3>Daten Dritter, die Kunden eingeben (Auftragsverarbeitung)</h3>
        <p>
          Soweit Kunden in der Anwendung personenbezogene Daten Dritter erfassen (z. B. Crew, Kontakte,
          Ansprechpartner), ist der jeweilige Kunde datenschutzrechtlich Verantwortlicher. FZ Development handelt
          insoweit als Auftragsverarbeiter auf Grundlage eines Auftragsverarbeitungsvertrags (Art. 28 DSGVO).
        </p>

        <h2>8. E-Mail-Versand (Resend)</h2>
        <p>
          Für den Versand von System-E-Mails (z. B. Einladungen, Passwort-Zurücksetzen, Benachrichtigungen)
          nutzen wir den Dienst Resend (Resend, Inc., USA). Die Verarbeitung erfolgt über die EU-Region des
          Anbieters; eine Übermittlung in die USA kann nicht ausgeschlossen werden. Grundlage hierfür sind die
          Standardvertragsklauseln der EU-Kommission bzw. das EU-US Data Privacy Framework. Verarbeitet werden
          die Empfänger-E-Mail-Adresse sowie Betreff und Inhalt der jeweiligen Nachricht. Rechtsgrundlage:
          Art. 6 Abs. 1 lit. b und lit. f DSGVO.
        </p>

        <h2>9. Externe Dienste (Karten, Adressen, Wetter)</h2>
        <p>
          Zur Komfortfunktion werden bei bestimmten Eingaben Anfragen an externe Anbieter gesendet. Dabei können
          Ihre Sucheingaben bzw. Orts- und Koordinatendaten an den jeweiligen Anbieter übermittelt werden:
        </p>
        <ul>
          <li><strong>Geoapify</strong> – Adress- und Ortssuche (Anbieter mit Sitz in der EU).</li>
          <li><strong>Photon</strong> – Adresssuche (OpenStreetMap-basiert, betrieben über komoot).</li>
          <li><strong>Open-Meteo</strong> – Wetterdaten zu Veranstaltungsorten (Anbieter mit Sitz in der EU).</li>
        </ul>
        <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (komfortable Bereitstellung der Funktionen).</p>

        <h2>10. Cookies und lokale Speicherung</h2>
        <p>
          Wir setzen keine Tracking- oder Analyse-Cookies und keine Werbe-Technologien ein. Für den Betrieb der
          Anwendung wird ausschließlich technisch notwendige lokale Speicherung im Browser verwendet (u. a. zur
          Aufrechterhaltung Ihrer Anmeldung). Ein Einwilligungsbanner ist hierfür nicht erforderlich.
          Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
        </p>

        <h2>11. Speicherdauer</h2>
        <p>
          Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke erforderlich ist
          oder gesetzliche Aufbewahrungsfristen bestehen. Kontodaten werden nach Löschung des Kontos entfernt,
          soweit keine gesetzlichen Pflichten entgegenstehen.
        </p>

        <h2>12. Ihre Rechte</h2>
        <p>Ihnen stehen nach der DSGVO folgende Rechte zu:</p>
        <ul>
          <li>Auskunft über die zu Ihnen gespeicherten Daten (Art. 15 DSGVO)</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
          <li>Löschung (Art. 17 DSGVO)</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
        </ul>
        <p>
          Zur Ausübung genügt eine formlose Nachricht an die oben genannte E-Mail-Adresse.
        </p>

        <h2>13. Beschwerderecht bei einer Aufsichtsbehörde</h2>
        <p>
          Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Für uns zuständig ist
          der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz.
        </p>

        <h2>14. Aktualität und Änderungen</h2>
        <p>
          Diese Datenschutzerklärung wird angepasst, sobald sich die Datenverarbeitung ändert (z. B. bei
          Einführung neuer Dienste). Es gilt jeweils die aktuell auf dieser Seite veröffentlichte Fassung.
        </p>

        <p className="text-sm text-gray-600 mt-12">Stand: Juni 2026</p>
      </main>

      <footer className="border-t border-gray-900">
        <div className="max-w-3xl mx-auto px-5 py-6 flex items-center justify-between text-sm text-gray-500">
          <span>© {new Date().getFullYear()} FZ Development</span>
          <div className="flex gap-5">
            <Link href="/impressum" className="hover:text-white">Impressum</Link>
            <Link href="/" className="hover:text-white">Startseite</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
