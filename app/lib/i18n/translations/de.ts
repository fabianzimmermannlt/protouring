// ─── ProTouring — Deutsche Übersetzungen ──────────────────────────────────────

const de = {

  // ── Navigation ──────────────────────────────────────────────────────────────
  'nav.desk':          'Schreibtisch',
  'nav.advancing':     'Vorbereitung',
  'nav.appointments':  'Termine',
  'nav.contacts':      'Kontakte',
  'nav.venues':        'Venues',
  'nav.partners':      'Partner',
  'nav.hotels':        'Hotels',
  'nav.vehicles':      'Fahrzeuge',
  'nav.equipment':     'Equipment',
  'nav.settings':      'Einstellungen',
  'nav.modules':       'Module',
  'nav.feedback':      'Feedback',

  // ── User Menu ───────────────────────────────────────────────────────────────
  'user.myProfile':    'Mein Profil',
  'user.layout':       'Layout',
  'user.artists':      'Artists',
  'user.artistsOverview': 'Übersicht',
  'user.newArtist':    'Neuer Artist',
  'user.logout':       'Abmelden',
  'user.language':     'Sprache',

  // ── Layout labels ───────────────────────────────────────────────────────────
  'layout.l1': 'L1 – Classic',
  'layout.l2': 'L2 – Sidebar',
  'layout.l3': 'L3 – Rail + Panel',

  // ── Termine — List ──────────────────────────────────────────────────────────
  'appointments.title':        'Termine',
  'appointments.new':          '+ Neuer Termin',
  'appointments.filter.current':  'Aktuelle',
  'appointments.filter.past':     'Vergangene',
  'appointments.filter.all':      'Alle',
  'appointments.calendar':        'Kalender',
  'appointments.empty':           'Keine Termine gefunden.',
  'appointments.loading':         'Wird geladen…',
  'appointments.backToList':      '← Terminliste',

  // ── Termine — Detail views ──────────────────────────────────────────────────
  'appointments.view.details':      'Details',
  'appointments.view.travelparty':  'Reisegruppe',
  'appointments.view.advancesheet': 'Advance Sheet',
  'appointments.view.guestlist':    'Gästeliste',

  // ── Termine — Panel (L3) ────────────────────────────────────────────────────
  'appointments.panel.filter.current':  'Aktuell',
  'appointments.panel.filter.past':     'Vergangen',
  'appointments.panel.filter.all':      'Alle',
  'appointments.panel.empty':           'Keine Termine.',
  'appointments.panel.noDate':          'Kein Datum',

  // ── Appointments — Table / Detail ──────────────────────────────────────────
  'appointments.search':              'Termine durchsuchen…',
  'appointments.noResults':           'Keine Treffer',
  'appointments.emptyState':          'Noch keine Termine. Mit „+ Neuer Termin" starten.',
  'appointments.notFound':            'Termin nicht gefunden',
  'appointments.backToList.link':     'Zur Terminliste',

  'table.date':         'Datum',
  'table.type':         'Art',
  'table.status':       'Status',
  'table.public':       'Öffentlich',
  'table.title':        'Titel',
  'table.city':         'Ort',
  'table.venue':        'Spielstätte',
  'table.availability': 'Verf.',
  'table.booked':       'Gebucht',

  'appointments.card.event':         'Veranstaltung',
  'appointments.card.venue':         'Spielstätte & Ort',
  'appointments.card.date':          'Datum',
  'appointments.card.title':         'Titel',
  'appointments.card.type':          'Art',
  'appointments.card.statusBooking': 'Status',
  'appointments.card.statusPublic':  'Öffentlich',
  'appointments.card.capacity':      'Kapazität',
  'appointments.card.website':       'Website',
  'appointments.card.noVenue':       'Keine Spielstätte verknüpft',
  'appointments.card.removeVenue':   'Spielstätte entfernen',
  'appointments.card.newVenue':      'Neue Spielstätte anlegen',
  'appointments.card.noPartner':     'Kein Partner verknüpft',
  'appointments.card.removePartner': 'Partner entfernen',
  'appointments.card.newPartner':    'Neuen Partner anlegen',

  'availability.available':   'Verfügbar',
  'availability.maybe':       'Vielleicht',
  'availability.unavailable': 'Nicht verfügbar',
  'availability.unknown':     'Keine Angabe',
  'availability.booked':      'Gebucht',
  'availability.rejected':    'Abgesagt',
  'availability.open':        'Offen',

  // Status values — stored in DB as German, displayed translated
  'status.booking.idea':        'Idee',
  'status.booking.option':      'Option',
  'status.booking.pending':     'noch nicht bestätigt',
  'status.booking.confirmed':   'bestätigt',
  'status.booking.completed':   'abgeschlossen',
  'status.booking.cancelled':   'abgesagt',
  'status.public.notPublic':    'nicht öffentlich',
  'status.public.tba':          'tba',
  'status.public.published':    'veröffentlicht',

  // ── Contacts ────────────────────────────────────────────────────────────────
  'contacts.title':           'Kontakte',
  'contacts.sub.overview':    'Übersicht',
  'contacts.sub.crewBooking': 'Crew-Vermittlung',
  'contacts.sub.conditions':  'Konditionen',

  // ── Venues ──────────────────────────────────────────────────────────────────
  'venues.title': 'Venues',

  // ── Partners ────────────────────────────────────────────────────────────────
  'partners.title': 'Partner',

  // ── Hotels ──────────────────────────────────────────────────────────────────
  'hotels.title': 'Hotels',

  // ── Vehicles ────────────────────────────────────────────────────────────────
  'vehicles.title': 'Fahrzeuge',

  // ── Equipment ───────────────────────────────────────────────────────────────
  'equipment.title':              'Equipment',
  'equipment.sub.items':          'Gegenstände',
  'equipment.sub.materials':      'Material',
  'equipment.sub.categories':     'Kategorien',
  'equipment.sub.eigentuemer':    'Eigentümer',
  'equipment.sub.carnets':        'Carnets',
  'equipment.addon':              'ADDON',

  // ── Settings ────────────────────────────────────────────────────────────────
  'settings.title':                  'Einstellungen',
  'settings.konto':                  'Konto',
  'settings.workspace':              'Workspace',
  'settings.sub.profil':             'Mein Profil',
  'settings.sub.appearance':         'Darstellung',
  'settings.sub.notifications':      'Benachrichtigungen',
  'settings.sub.ersteSchritte':      'Erste Schritte',
  'settings.sub.artist':             'Artist',
  'settings.sub.permissions':        'Berechtigungen',
  'settings.sub.contacts':           'Kontakte',
  'settings.sub.partners':           'Partners',
  'settings.sub.gewerke':            'Gewerke',
  'settings.sub.guestlist':          'Gästeliste',
  'settings.sub.daysheet':           'Daysheet',
  'settings.sub.vorlagen':           'Vorlagen',
  'settings.language.label':         'Sprache / Language',
  'settings.language.de':            'Deutsch',
  'settings.language.en':            'English',

  // ── Profile ─────────────────────────────────────────────────────────────────
  'profile.personalData':    'Persönliche Daten',
  'profile.contactData':     'Kontaktdaten',
  'profile.professionalData':'Berufliche Daten',
  'profile.travelData':      'Reisedaten',
  'profile.diet':            'Ernährung',
  'profile.clothing':        'Kleidergrößen',
  'profile.password':        'Passwort',
  'profile.calendar':        'Kalender-Abo (iCal)',
  'profile.firstName':       'Vorname',
  'profile.lastName':        'Nachname',
  'profile.birthDate':       'Geburtstag',
  'profile.gender':          'Geschlecht',
  'profile.pronouns':        'Pronomen',
  'profile.email':           'Email',
  'profile.phone':           'Telefon',
  'profile.postalCode':      'PLZ',
  'profile.residence':       'Wohnort',
  'profile.address':         'Adresse',
  'profile.save':            'Speichern',
  'profile.saved':           'Gespeichert',
  'profile.saving':          'Speichern…',

  // ── General / Shared ────────────────────────────────────────────────────────
  'general.loading':   'Wird geladen…',
  'general.save':      'Speichern',
  'general.saved':     'Gespeichert',
  'general.saving':    'Speichern…',
  'general.cancel':    'Abbrechen',
  'general.delete':    'Löschen',
  'general.edit':      'Bearbeiten',
  'general.close':     'Schließen',
  'general.search':    'Suchen…',
  'general.add':       'Hinzufügen',
  'general.remove':    'Entfernen',
  'general.yes':       'Ja',
  'general.no':        'Nein',
  'general.error':     'Fehler',
  'general.notFound':  'Nicht gefunden',
  'general.back':      'Zurück',
  'general.next':      'Weiter',
  'general.of':        'von',

  // ── Panel header ────────────────────────────────────────────────────────────
  'panel.closePanel':  'Panel schließen',
  'panel.openPanel':   'Panel öffnen',

} as const

export default de
export type TranslationKey = keyof typeof de
