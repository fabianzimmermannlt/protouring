'use client'

import Link from 'next/link'
import {
  Music, ArrowRight, Check, Package, Truck, Users, MapPin,
  CalendarDays, Building2, BedDouble, FileText, Globe, ShieldCheck,
} from 'lucide-react'

// Platzhalter-/Screenshot-Rahmen. src optional – solange keine echten
// Screenshots vorliegen, wird ein sauberer Platzhalter gezeigt.
function Shot({ src, label, className = '' }: { src?: string; label: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900 overflow-hidden shadow-2xl ${className}`}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-800 bg-gray-900/80">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        <span className="ml-2 text-[11px] text-gray-500 truncate">protouring.de — {label}</span>
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="w-full block" />
      ) : (
        <div className="aspect-[16/10] w-full bg-gradient-to-br from-gray-800 via-gray-900 to-gray-950 flex items-center justify-center">
          <span className="text-gray-600 text-sm">{label}</span>
        </div>
      )}
    </div>
  )
}

const FEATURES = [
  { icon: CalendarDays, title: 'Termine', text: 'Tourkalender mit Verfügbarkeiten und Crew-Buchung an einem Ort.' },
  { icon: Users, title: 'Kontakte & Crew', text: 'Crew-Verwaltung mit branchenspezifischen Feldern und Rollen.' },
  { icon: MapPin, title: 'Venues', text: 'Spielstätten-Datenbank: Kapazität, Bühnenmaße, Nightliner, Merch-Fee.' },
  { icon: Building2, title: 'Partner', text: 'Dienstleister und externe Partner sauber organisiert.' },
  { icon: BedDouble, title: 'Hotels', text: 'Unterkünfte pro Show – mit Anreise und Zimmerlisten.' },
  { icon: Truck, title: 'Fahrzeuge', text: 'Transport und Logistik im Griff, pro Tour und Show.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      {/* NAV */}
      <header className="sticky top-0 z-30 backdrop-blur bg-gray-950/80 border-b border-gray-900">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 bg-yellow-400 rounded-full flex items-center justify-center">
              <Music className="h-5 w-5 text-gray-900" />
            </span>
            <span className="font-bold text-white text-lg tracking-tight">ProTouring</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Funktionen</a>
            <a href="#usp" className="hover:text-white transition-colors">Warum ProTouring</a>
            <a href="#screens" className="hover:text-white transition-colors">Einblick</a>
            <a href="#preise" className="hover:text-white transition-colors">Preise</a>
          </nav>
          <Link href="/login" className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-semibold rounded-lg text-sm transition-colors">
            Anmelden
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(250,204,21,0.10),transparent)]" />
        <div className="relative max-w-6xl mx-auto px-5 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-800 bg-gray-900 text-xs text-gray-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Aktuell in geschlossener Beta
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-[1.05]">
            Tour-Management,<br />das die Branche versteht.
          </h1>
          <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto">
            ProTouring bringt Termine, Crew, Venues, Hotels, Fahrzeuge und Equipment zusammen –
            für Tourmanager und Produktionsleiter, die Touren operativ steuern.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-semibold rounded-lg transition-colors">
              Anmelden <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#features" className="px-6 py-3 border border-gray-700 hover:border-gray-500 text-gray-200 font-medium rounded-lg transition-colors">
              Funktionen ansehen
            </a>
          </div>

          <div className="mt-14 max-w-4xl mx-auto">
            <Shot label="Termine & Advancing" />
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="max-w-4xl mx-auto px-5 py-20 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white">Schluss mit Excel, WhatsApp und Zettelchaos</h2>
        <p className="mt-4 text-gray-400 leading-relaxed">
          Heute liegt Tour-Wissen verstreut in Tabellen, Chats und Köpfen. ProTouring verbindet alle
          Beteiligten einer Tour – TM, PL, FOH, Crew – und kennt die Felder, die deine Branche wirklich
          braucht: Nightliner-Stellplatz, Bühnenmaße, lichte Höhe, Carnet ATA, Ladeplan.
        </p>
      </section>

      {/* FEATURES */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Alles für die Produktion an einem Ort</h2>
          <p className="mt-3 text-gray-400">Eine Oberfläche statt zwölf Tools.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 hover:border-gray-700 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-yellow-400/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-yellow-400" />
              </div>
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="mt-1.5 text-sm text-gray-400 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* USP */}
      <section id="usp" className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Was kein anderes Tool kann</h2>
          <p className="mt-3 text-gray-400">Genau die Lücken, an denen J-Show & Master Tour scheitern.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-yellow-400/20 bg-gradient-to-b from-yellow-400/[0.06] to-transparent p-7">
            <div className="h-11 w-11 rounded-lg bg-yellow-400/15 flex items-center justify-center mb-5">
              <Package className="w-6 h-6 text-yellow-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Carnet ATA & Equipmentlisten</h3>
            <p className="mt-3 text-gray-400 leading-relaxed">
              Equipmentlisten mit Case-Daten – Maße, Gewicht, Inhalt, Seriennummer, Ursprungsland, Wert.
              CSV-Export passend für die IHK-Portale, mehrsprachig (DE/EN/FR) und über Touren wiederverwendbar.
              Die Versicherungsliste fällt aus derselben Datenbasis ab.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-gray-300">
              <li className="flex gap-2"><Globe className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Mehrsprachige Ausgabe für jeden Grenzübergang</li>
              <li className="flex gap-2"><FileText className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Carnet-ATA-Export für die IHK</li>
              <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Versicherungsliste als Nebenprodukt</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-7">
            <div className="h-11 w-11 rounded-lg bg-yellow-400/15 flex items-center justify-center mb-5">
              <Truck className="w-6 h-6 text-yellow-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Ladeplanung, die sofort hilft</h3>
            <p className="mt-3 text-gray-400 leading-relaxed">
              Case-Labels für Labelprinter oder als PDF. Position im Venue beim Ausladen (Bühne, FOH, Backline, Merch)
              und Nummerierung für die Einladereihenfolge. Niedrige Einstiegshürde, sofort nützlich.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-gray-300">
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Case-Labels per Druck oder PDF</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Ausladeposition pro Bereich</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Einladereihenfolge auf Knopfdruck</li>
            </ul>
          </div>
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section id="screens" className="max-w-6xl mx-auto px-5 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Ein Blick in die App</h2>
          <p className="mt-3 text-gray-400">Aufgeräumt, schnell, gebaut für den Tour-Alltag.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <Shot label="Termine-Übersicht" />
          <Shot label="Venue-Detail" />
          <Shot label="Kontakte & Crew" />
          <Shot label="Hotels & Anreise" />
        </div>
      </section>

      {/* PREISE */}
      <section id="preise" className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center mb-4">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Preise</h2>
          <p className="mt-3 text-gray-400">Abgerechnet pro Artist/Organisation – User-Zugänge immer inklusive. Kostenlos starten, jederzeit upgraden.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5 mt-10 items-stretch">
          {/* Starter / Free */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-7 flex flex-col">
            <h3 className="font-semibold text-white">Starter</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">0€</span>
              <span className="text-gray-500 text-sm">für immer</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">Zum Ausprobieren – eingeschränkt</p>
            <ul className="mt-6 space-y-2.5 text-sm text-gray-300 flex-1">
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Bis zu 3 Events</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Je 3 Venues, Hotels, Fahrzeuge, Kontakte</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Alle Kernmodule zum Testen</li>
            </ul>
            <Link href="/login" className="mt-7 text-center px-4 py-2.5 border border-gray-700 hover:border-gray-500 text-white rounded-lg text-sm font-medium transition-colors">
              Kostenlos starten
            </Link>
          </div>
          {/* Pro */}
          <div className="rounded-2xl border-2 border-yellow-400 bg-gradient-to-b from-yellow-400/[0.07] to-transparent p-7 flex flex-col relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-400 text-gray-900 text-xs font-semibold rounded-full">Empfohlen</span>
            <h3 className="font-semibold text-white">Pro</h3>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white">199€</span>
              <span className="text-gray-500 text-sm">/ Jahr</span>
            </div>
            <p className="mt-1 text-xs text-gray-500"><span className="line-through">249€</span> · Early-Bird im 1. Jahr</p>
            <ul className="mt-6 space-y-2.5 text-sm text-gray-300 flex-1">
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Unbegrenzte Events &amp; Daten</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Unbegrenzte User</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Alle Kernmodule ohne Limits</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Add-ons frei zubuchbar</li>
            </ul>
            <Link href="/login" className="mt-7 text-center px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-gray-900 rounded-lg text-sm font-semibold transition-colors">
              Pro holen
            </Link>
          </div>
          {/* Enterprise */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-7 flex flex-col">
            <h3 className="font-semibold text-white">Enterprise</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">ab 800€</span>
              <span className="text-gray-500 text-sm">/ Jahr</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">für Agenturen – individuell</p>
            <ul className="mt-6 space-y-2.5 text-sm text-gray-300 flex-1">
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> White-Label: Logo &amp; Farben der Agentur</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Garantien (z.B. Hosting komplett EU/DE)</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Datenübernahme aus Altsystemen</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> Individuelle Anpassungen &amp; Pflege</li>
            </ul>
            <a href="mailto:info@protouring.de" className="mt-7 text-center px-4 py-2.5 border border-gray-700 hover:border-gray-500 text-white rounded-lg text-sm font-medium transition-colors">
              Kontakt aufnehmen
            </a>
          </div>
        </div>

        {/* ADD-ONS */}
        <div className="mt-10 rounded-2xl border border-gray-800 bg-gray-900/30 p-7">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-5">
            <h3 className="font-semibold text-white">Add-ons <span className="text-gray-500 font-normal text-sm">– je 49€ / Jahr, zu Pro dazubuchbar</span></h3>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
              <div className="flex items-center gap-2 mb-2"><Package className="w-4 h-4 text-yellow-400" /><span className="font-medium text-white text-sm">Equipment &amp; Ladeplanung</span></div>
              <p className="text-xs text-gray-400 leading-relaxed">Case-Datenbank, Labels und Ausladeposition pro Bereich.</p>
              <p className="text-sm text-gray-300 mt-3 font-semibold">49€ <span className="text-gray-500 font-normal">/ Jahr</span></p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
              <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-yellow-400" /><span className="font-medium text-white text-sm">Carnet ATA</span></div>
              <p className="text-xs text-gray-400 leading-relaxed">Mehrsprachige Equipmentlisten &amp; CSV-Export für die IHK.</p>
              <p className="text-sm text-gray-300 mt-3 font-semibold">49€ <span className="text-gray-500 font-normal">/ Jahr</span></p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
              <div className="flex items-center gap-2 mb-2"><CalendarDays className="w-4 h-4 text-yellow-400" /><span className="font-medium text-white text-sm">Pro-Tour <span className="text-[10px] uppercase tracking-wide text-yellow-400/80">in Entwicklung</span></span></div>
              <p className="text-xs text-gray-400 leading-relaxed">Lauflisten, Termin-Zusammenfassungen, terminübergreifende Übersichten.</p>
              <p className="text-sm text-gray-300 mt-3 font-semibold">49€ <span className="text-gray-500 font-normal">/ Jahr</span></p>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-gray-600 mt-6">Alle Preise zzgl. MwSt. Jährliche Abrechnung pro Artist/Organisation.</p>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-5 py-16 text-center">
        <div className="rounded-2xl border border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 p-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Bereit, deine Tour in den Griff zu bekommen?</h2>
          <p className="mt-3 text-gray-400">Melde dich an und steuere deine Produktion an einem Ort.</p>
          <Link href="/login" className="mt-7 inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-semibold rounded-lg transition-colors">
            Anmelden <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-900">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 bg-yellow-400 rounded-full flex items-center justify-center">
              <Music className="h-4 w-4 text-gray-900" />
            </span>
            <span className="font-semibold text-gray-300">ProTouring</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="mailto:info@protouring.de" className="hover:text-white transition-colors">Kontakt</a>
            <Link href="/login" className="hover:text-white transition-colors">Anmelden</Link>
          </div>
          <span>© {new Date().getFullYear()} ProTouring</span>
        </div>
      </footer>
    </div>
  )
}
