// ─── ProTouring — English Translations ───────────────────────────────────────

const en = {

  // ── Navigation ──────────────────────────────────────────────────────────────
  'nav.desk':          'Dashboard',
  'nav.advancing':     'Advancing',
  'nav.appointments':  'Events',
  'nav.contacts':      'Contacts',
  'nav.venues':        'Venues',
  'nav.partners':      'Partners',
  'nav.hotels':        'Hotels',
  'nav.vehicles':      'Vehicles',
  'nav.equipment':     'Equipment',
  'nav.settings':      'Settings',
  'nav.modules':       'Modules',
  'nav.feedback':      'Feedback',

  // ── User Menu ───────────────────────────────────────────────────────────────
  'user.myProfile':    'My Profile',
  'user.layout':       'Layout',
  'user.artists':      'Artists',
  'user.artistsOverview': 'Overview',
  'user.newArtist':    'New Artist',
  'user.logout':       'Sign Out',
  'user.language':     'Language',

  // ── Layout labels ───────────────────────────────────────────────────────────
  'layout.l1': 'L1 – Classic',
  'layout.l2': 'L2 – Sidebar',
  'layout.l3': 'L3 – Rail + Panel',

  // ── Appointments — List ─────────────────────────────────────────────────────
  'appointments.title':        'Events',
  'appointments.new':          '+ New Event',
  'appointments.filter.current':  'Upcoming',
  'appointments.filter.past':     'Past',
  'appointments.filter.all':      'All',
  'appointments.calendar':        'Calendar',
  'appointments.empty':           'No events found.',
  'appointments.loading':         'Loading…',
  'appointments.backToList':      '← Event List',

  // ── Appointments — Detail views ─────────────────────────────────────────────
  'appointments.view.details':      'Details',
  'appointments.view.travelparty':  'Travel Party',
  'appointments.view.advancesheet': 'Advance Sheet',
  'appointments.view.guestlist':    'Guest List',

  // ── Appointments — Panel (L3) ───────────────────────────────────────────────
  'appointments.panel.filter.current':  'Upcoming',
  'appointments.panel.filter.past':     'Past',
  'appointments.panel.filter.all':      'All',
  'appointments.panel.empty':           'No events.',
  'appointments.panel.noDate':          'No date',

  // ── Appointments — Table / Detail ──────────────────────────────────────────
  'appointments.search':              'Search events…',
  'appointments.noResults':           'No results',
  'appointments.emptyState':          'No events yet. Start with "+ New Event".',
  'appointments.notFound':            'Event not found',
  'appointments.backToList.link':     'Back to events',

  'table.date':         'Date',
  'table.type':         'Type',
  'table.status':       'Status',
  'table.public':       'Public',
  'table.title':        'Title',
  'table.city':         'City',
  'table.venue':        'Venue',
  'table.availability': 'Avail.',
  'table.booked':       'Booked',

  'appointments.card.event':         'Event',
  'appointments.card.venue':         'Venue & Location',
  'appointments.card.date':          'Date',
  'appointments.card.title':         'Title',
  'appointments.card.type':          'Type',
  'appointments.card.statusBooking': 'Status',
  'appointments.card.statusPublic':  'Public',
  'appointments.card.capacity':      'Capacity',
  'appointments.card.website':       'Website',
  'appointments.card.noVenue':       'No venue linked',
  'appointments.card.removeVenue':   'Remove venue',
  'appointments.card.newVenue':      'Create new venue',
  'appointments.card.noPartner':     'No partner linked',
  'appointments.card.removePartner': 'Remove partner',
  'appointments.card.newPartner':    'Create new partner',

  'availability.available':   'Available',
  'availability.maybe':       'Maybe',
  'availability.unavailable': 'Unavailable',
  'availability.unknown':     'Not specified',
  'availability.booked':      'Booked',
  'availability.rejected':    'Cancelled',
  'availability.open':        'Open',

  // Status values — stored in DB as German, displayed translated
  'status.booking.idea':        'Idea',
  'status.booking.option':      'Option',
  'status.booking.pending':     'Pending',
  'status.booking.confirmed':   'Confirmed',
  'status.booking.completed':   'Completed',
  'status.booking.cancelled':   'Cancelled',
  'status.public.notPublic':    'Not public',
  'status.public.tba':          'TBA',
  'status.public.published':    'Published',

  // ── Contacts ────────────────────────────────────────────────────────────────
  'contacts.title':           'Contacts',
  'contacts.sub.overview':    'Overview',
  'contacts.sub.crewBooking': 'Crew Booking',
  'contacts.sub.conditions':  'Conditions',

  // ── Venues ──────────────────────────────────────────────────────────────────
  'venues.title': 'Venues',

  // ── Partners ────────────────────────────────────────────────────────────────
  'partners.title': 'Partners',

  // ── Hotels ──────────────────────────────────────────────────────────────────
  'hotels.title': 'Hotels',

  // ── Vehicles ────────────────────────────────────────────────────────────────
  'vehicles.title': 'Vehicles',

  // ── Equipment ───────────────────────────────────────────────────────────────
  'equipment.title':              'Equipment',
  'equipment.sub.items':          'Cases',
  'equipment.sub.materials':      'Gear',
  'equipment.sub.categories':     'Categories',
  'equipment.sub.eigentuemer':    'Owners',
  'equipment.sub.carnets':        'Carnets',
  'equipment.addon':              'ADDON',

  // ── Settings ────────────────────────────────────────────────────────────────
  'settings.title':                  'Settings',
  'settings.konto':                  'Account',
  'settings.workspace':              'Workspace',
  'settings.sub.profil':             'My Profile',
  'settings.sub.appearance':         'Appearance',
  'settings.sub.notifications':      'Notifications',
  'settings.sub.ersteSchritte':      'Getting Started',
  'settings.sub.artist':             'Artist',
  'settings.sub.permissions':        'Permissions',
  'settings.sub.contacts':           'Contacts',
  'settings.sub.partners':           'Partners',
  'settings.sub.gewerke':            'Departments',
  'settings.sub.guestlist':          'Guest List',
  'settings.sub.daysheet':           'Day Sheet',
  'settings.sub.vorlagen':           'Templates',
  'settings.language.label':         'Language / Sprache',
  'settings.language.de':            'Deutsch',
  'settings.language.en':            'English',

  // ── Profile ─────────────────────────────────────────────────────────────────
  'profile.personalData':    'Personal Data',
  'profile.contactData':     'Contact Info',
  'profile.professionalData':'Professional Info',
  'profile.travelData':      'Travel Info',
  'profile.diet':            'Diet & Nutrition',
  'profile.clothing':        'Clothing Sizes',
  'profile.password':        'Password',
  'profile.calendar':        'Calendar Subscription (iCal)',
  'profile.firstName':       'First Name',
  'profile.lastName':        'Last Name',
  'profile.birthDate':       'Date of Birth',
  'profile.gender':          'Gender',
  'profile.pronouns':        'Pronouns',
  'profile.email':           'Email',
  'profile.phone':           'Phone',
  'profile.postalCode':      'Postal Code',
  'profile.residence':       'City',
  'profile.address':         'Address',
  'profile.save':            'Save',
  'profile.saved':           'Saved',
  'profile.saving':          'Saving…',

  // ── General / Shared ────────────────────────────────────────────────────────
  'general.loading':   'Loading…',
  'general.save':      'Save',
  'general.saved':     'Saved',
  'general.saving':    'Saving…',
  'general.cancel':    'Cancel',
  'general.delete':    'Delete',
  'general.edit':      'Edit',
  'general.close':     'Close',
  'general.search':    'Search…',
  'general.add':       'Add',
  'general.remove':    'Remove',
  'general.yes':       'Yes',
  'general.no':        'No',
  'general.error':     'Error',
  'general.notFound':  'Not found',
  'general.back':      'Back',
  'general.next':      'Next',
  'general.of':        'of',

  // ── Panel header ────────────────────────────────────────────────────────────
  'panel.closePanel':  'Close panel',
  'panel.openPanel':   'Open panel',

} as const

export default en
