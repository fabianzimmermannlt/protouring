/**
 * ProTouring API Client
 *
 * Liest Token und aktiven Tenant aus localStorage (gesetzt nach Login).
 * Alle Tour-Daten gehen über diese Funktionen – kein direktes localStorage mehr.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
export { API_BASE };

// Keys für Session-Daten in localStorage (Token/Tenant/User – kein Business-Data)
export const AUTH_TOKEN_KEY = 'protouring_auth_token';
export const CURRENT_TENANT_KEY = 'protouring_current_tenant';
export const CURRENT_USER_KEY = 'protouring_current_user';
export const ALL_TENANTS_KEY = 'protouring_all_tenants';

// ============================================
// Auth helpers
// ============================================

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

const PREVIEW_ROLE_KEY = 'protouring_preview_role'

export function getCurrentTenant(): { id: number; name: string; slug: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CURRENT_TENANT_KEY);
  if (!raw) return null;
  try {
    const tenant = JSON.parse(raw);
    const previewRole = localStorage.getItem(PREVIEW_ROLE_KEY);
    if (previewRole) return { ...tenant, role: previewRole };
    return tenant;
  } catch { return null; }
}

/** Echte Tenant-Rolle ohne Preview-Override — für Admin-Checks die den Preview steuern */
export function getRealTenantRole(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CURRENT_TENANT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw)?.role ?? null; } catch { return null; }
}

export function setPreviewRole(role: string | null) {
  if (typeof window === 'undefined') return;
  if (role) localStorage.setItem(PREVIEW_ROLE_KEY, role);
  else localStorage.removeItem(PREVIEW_ROLE_KEY);
}

export function getPreviewRole(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PREVIEW_ROLE_KEY);
}

export function getCurrentUser(): { id: number; email: string; firstName: string; lastName: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setAuthSession(token: string, tenant: object, user?: object, allTenants?: object[]) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(CURRENT_TENANT_KEY, JSON.stringify(tenant));
  if (user) localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  if (allTenants) localStorage.setItem(ALL_TENANTS_KEY, JSON.stringify(allTenants));
}

export function getAllTenants(): Array<{ id: number; name: string; slug: string; status: string; role: string }> {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(ALL_TENANTS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function setAllTenants(tenants: object[]) {
  localStorage.setItem(ALL_TENANTS_KEY, JSON.stringify(tenants));
}

export function updateCurrentTenantRole(role: string) {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(CURRENT_TENANT_KEY);
  if (!raw) return;
  try {
    const tenant = JSON.parse(raw);
    localStorage.setItem(CURRENT_TENANT_KEY, JSON.stringify({ ...tenant, role }));
  } catch { /* ignore */ }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(CURRENT_TENANT_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(ALL_TENANTS_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAuthToken() && !!getCurrentTenant();
}

export function logout(): void {
  clearAuthSession();
  window.location.href = '/login';
}

// ============================================
// HTTP helper
// ============================================

interface RequestOptions {
  method?: string;
  body?: object | string;
  skipTenant?: boolean; // für Routen die keinen Tenant brauchen (auth, plans)
}

class ApiError extends Error {
  status: number;
  deactivated?: boolean;
  tenantName?: string;
  constructor(message: string, status: number, deactivated?: boolean, tenantName?: string) {
    super(message);
    this.status = status;
    this.deactivated = deactivated;
    this.tenantName = tenantName;
  }
}

export { ApiError }

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = getAuthToken();
  const tenant = getCurrentTenant();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!options.skipTenant && tenant) headers['X-Tenant-Slug'] = tenant.slug;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Server-Fehler ${res.status} (keine JSON-Antwort)` }));
    if (err.deactivated && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('account-deactivated', { detail: { tenantName: err.tenantName } }))
    }
    throw new ApiError(err.error || `Request failed (${res.status})`, res.status, err.deactivated, err.tenantName);
  }

  return res.json();
}

// ============================================
// Auth API
// ============================================

export interface LoginResponse {
  token: string;
  user: { id: number; email: string; firstName: string; lastName: string };
  tenants: Array<{ id: number; name: string; slug: string; status: string; role: string }>;
  currentTenant: { id: number; name: string; slug: string; status: string; role: string };
}

export async function login(email: string, password: string, tenantSlug?: string): Promise<LoginResponse> {
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, password, tenantSlug },
    skipTenant: true,
  });
}

export async function register(data: {
  tenantName: string;
  tenantEmail: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  password: string;
}) {
  return request('/api/tenants/register', { method: 'POST', body: data, skipTenant: true });
}

export async function getMyTenants(): Promise<{ tenants: Array<{ id: number; name: string; slug: string; status: string; trial_ends_at: string | null; role: string }> }> {
  return request('/api/me/tenants', { skipTenant: true });
}

export async function createTenant(data: { name: string; email?: string }): Promise<{ tenant: { id: number; name: string; slug: string; status: string; role: string } }> {
  return request('/api/tenants', { method: 'POST', body: data, skipTenant: true });
}

export interface MyTermin {
  id: number
  date: string
  title: string
  city: string
  art: string
  statusBooking: string
  tenantId: number
  tenantName: string
  tenantSlug: string
}

export async function getMyTermine(): Promise<{ termine: MyTermin[] }> {
  return request('/api/me/termine', { skipTenant: true });
}

// ============================================
// Venues API
// ============================================

export interface Venue {
  id: string;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  website: string;
  arrival: string;
  arrivalStreet: string;
  arrivalPostalCode: string;
  arrivalCity: string;
  capacity: string;
  capacitySeated: string;
  stageDimensions: string;
  clearanceHeight: string;
  merchandiseFee: string;
  merchandiseStand: string;
  wardrobe: string;
  showers: string;
  wifi: string;
  parking: string;
  nightlinerParking: string;
  loadingPath: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export type VenueFormData = Omit<Venue, 'id' | 'createdAt' | 'updatedAt'>;

export async function getVenues(): Promise<Venue[]> {
  const res = await request<{ venues: Venue[] }>('/api/venues');
  return res.venues;
}

export async function createVenue(data: VenueFormData): Promise<Venue> {
  const res = await request<{ venue: Venue }>('/api/venues', { method: 'POST', body: data });
  return res.venue;
}

export async function updateVenue(id: string, data: VenueFormData): Promise<Venue> {
  const res = await request<{ venue: Venue }>(`/api/venues/${id}`, { method: 'PUT', body: data });
  return res.venue;
}

export async function deleteVenue(id: string): Promise<void> {
  await request(`/api/venues/${id}`, { method: 'DELETE' });
}

// ============================================
// Contacts API
// ============================================

export interface Contact {
  id: string;
  firstName: string; lastName: string;
  function1: string; function2: string; function3: string;
  specification: string; accessRights: string;
  email: string; phone: string; mobile: string;
  address: string; postalCode: string; residence: string;
  taxId: string; website: string; birthDate: string;
  gender: string; pronouns: string; birthPlace: string;
  nationality: string; idNumber: string; socialSecurity: string;
  diet: string; glutenFree: boolean; lactoseFree: boolean;
  allergies: string; emergencyContact: string; emergencyPhone: string;
  shirtSize: string; hoodieSize: string; pantsSize: string; shoeSize: string;
  hotelInfo: string; hotelAlias: string;
  languages: string; driversLicense: string; railcard: string; frequentFlyer: string;
  bankAccount: string; bankIban: string; bankBic: string;
  taxNumber: string; vatId: string; crewToolActive: boolean;
  hourlyRate: number; dailyRate: number; notes: string;
  createdAt?: string; updatedAt?: string;
  userId?: number | null;
  tenantRole?: string | null;
  contactType?: 'crew' | 'guest';
  invitePending?: boolean;
}
export type ContactFormData = Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'contactType' | 'tenantRole' | 'invitePending'>;

// TenantUser wird unten neu definiert (Rollen-System)

export async function getTenantUsers(): Promise<TenantUser[]> {
  const res = await request<{ users: TenantUser[] }>('/api/admin/users');
  return res.users;
}

export async function createTenantUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  contactId?: string;
}): Promise<{ userId: number; message: string }> {
  return request('/api/admin/users', { method: 'POST', body: data });
}

export async function resetUserPassword(userId: number, password: string): Promise<void> {
  await request(`/api/admin/users/${userId}/password`, { method: 'PUT', body: { password } });
}

export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  await request('/api/me/password', { method: 'PUT', body: { currentPassword, newPassword } });
}

export async function getContacts(): Promise<Contact[]> {
  const res = await request<{ contacts: Contact[] }>('/api/contacts');
  return res.contacts;
}
export async function getContact(id: number): Promise<Contact> {
  const res = await request<{ contact: Contact }>(`/api/contacts/${id}`);
  return res.contact;
}
export async function getOrCreateUserContact(userId: number): Promise<Contact> {
  const res = await request<{ contact: Contact }>(`/api/settings/users/${userId}/contact`);
  return res.contact;
}
export async function createContact(data: ContactFormData): Promise<Contact> {
  const res = await request<{ contact: Contact }>('/api/contacts', { method: 'POST', body: data });
  return res.contact;
}
export async function updateContact(id: string, data: ContactFormData): Promise<Contact> {
  const res = await request<{ contact: Contact }>(`/api/contacts/${id}`, { method: 'PUT', body: data });
  return res.contact;
}
export async function deleteContact(id: string): Promise<void> {
  await request(`/api/contacts/${id}`, { method: 'DELETE' });
}

// Eigener Kontakt-Eintrag im aktuellen Tenant
export async function getMyContact(): Promise<Contact> {
  const res = await request<{ contact: Contact }>('/api/me/contact');
  return res.contact;
}

export async function updateMyContact(data: ContactFormData): Promise<Contact> {
  const res = await request<{ contact: Contact }>('/api/me/contact', { method: 'PUT', body: data });
  return res.contact;
}

// ============================================
// Tenant Settings API
// ============================================

export async function getTenantSetting(key: string): Promise<string | null> {
  const res = await request<{ key: string; value: string | null }>(`/api/tenant/settings/${key}`);
  return res.value;
}

export async function setTenantSetting(key: string, value: string): Promise<void> {
  await request(`/api/tenant/settings/${key}`, { method: 'PUT', body: { value } });
}

export interface TenantArtistSettings {
  name: string;
  displayName: string;
  shortCode: string;
  homebase: string;
  genre: string;
  email: string;
  phone: string;
  website: string;
}

export async function getTenantArtistSettings(): Promise<TenantArtistSettings> {
  const res = await request<{ settings: Record<string, string> }>('/api/tenant/settings');
  const s = res.settings;
  return {
    name:        s.name        ?? '',
    displayName: s.display_name ?? '',
    shortCode:   s.short_code  ?? '',
    homebase:    s.homebase    ?? '',
    genre:       s.genre       ?? '',
    email:       s.email       ?? '',
    phone:       s.phone       ?? '',
    website:     s.website     ?? '',
  };
}

export async function updateTenantArtistSettings(data: Omit<TenantArtistSettings, 'name'>): Promise<TenantArtistSettings> {
  const res = await request<{ settings: Record<string, string> }>('/api/tenant/settings', { method: 'PUT', body: data });
  const s = res.settings;
  return {
    name:        s.name        ?? '',
    displayName: s.display_name ?? '',
    shortCode:   s.short_code  ?? '',
    homebase:    s.homebase    ?? '',
    genre:       s.genre       ?? '',
    email:       s.email       ?? '',
    phone:       s.phone       ?? '',
    website:     s.website     ?? '',
  };
}

// ============================================
// Tenant Billing API
// ============================================

export interface TenantBilling {
  company: string;
  firstName: string;
  lastName: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  taxId: string;
  email: string;
}

export async function getTenantBilling(): Promise<TenantBilling> {
  const res = await request<{ billing: Record<string, string> }>('/api/tenant/billing');
  const b = res.billing ?? {};
  return {
    company:    b.billing_company     ?? '',
    firstName:  b.billing_first_name  ?? '',
    lastName:   b.billing_last_name   ?? '',
    address:    b.billing_address     ?? '',
    postalCode: b.billing_postal_code ?? '',
    city:       b.billing_city        ?? '',
    phone:      b.billing_phone       ?? '',
    taxId:      b.billing_tax_id      ?? '',
    email:      b.billing_email       ?? '',
  };
}

export async function updateTenantBilling(data: TenantBilling): Promise<TenantBilling> {
  const res = await request<{ billing: Record<string, string> }>('/api/tenant/billing', { method: 'PUT', body: data });
  const b = res.billing ?? {};
  return {
    company:    b.billing_company     ?? '',
    firstName:  b.billing_first_name  ?? '',
    lastName:   b.billing_last_name   ?? '',
    address:    b.billing_address     ?? '',
    postalCode: b.billing_postal_code ?? '',
    city:       b.billing_city        ?? '',
    phone:      b.billing_phone       ?? '',
    taxId:      b.billing_tax_id      ?? '',
    email:      b.billing_email       ?? '',
  };
}

// ============================================
// User Format API
// ============================================

export interface UserFormat {
  language: string;
  timezone: string;
  currency: string;
}

export async function getUserFormat(): Promise<UserFormat> {
  const res = await request<{ format: Record<string, string> }>('/api/me/format');
  const f = res.format ?? {};
  return {
    language: f.format_language  ?? 'de-DE',
    timezone: f.format_timezone  ?? 'Europe/Berlin',
    currency: f.format_currency  ?? 'EUR',
  };
}

export async function updateUserFormat(data: UserFormat): Promise<UserFormat> {
  const res = await request<{ format: Record<string, string> }>('/api/me/format', { method: 'PUT', body: data });
  const f = res.format ?? {};
  return {
    language: f.format_language  ?? 'de-DE',
    timezone: f.format_timezone  ?? 'Europe/Berlin',
    currency: f.format_currency  ?? 'EUR',
  };
}

// ============================================
// Hotels API
// ============================================

export interface Hotel {
  id: string; name: string; street: string; postalCode: string; city: string;
  state: string; country: string; email: string; phone: string; website: string;
  reception: string; checkIn: string; checkOut: string; earlyCheckIn: string;
  lateCheckOut: string; breakfast: string; breakfastWeekend: string; additionalInfo: string;
  createdAt?: string; updatedAt?: string;
}
export type HotelFormData = Omit<Hotel, 'id' | 'createdAt' | 'updatedAt'>;

export async function getHotels(): Promise<Hotel[]> {
  const res = await request<{ hotels: Hotel[] }>('/api/hotels');
  return res.hotels;
}
export async function createHotel(data: HotelFormData): Promise<Hotel> {
  const res = await request<{ hotel: Hotel }>('/api/hotels', { method: 'POST', body: data });
  return res.hotel;
}
export async function updateHotel(id: string, data: HotelFormData): Promise<Hotel> {
  const res = await request<{ hotel: Hotel }>(`/api/hotels/${id}`, { method: 'PUT', body: data });
  return res.hotel;
}
export async function deleteHotel(id: string): Promise<void> {
  await request(`/api/hotels/${id}`, { method: 'DELETE' });
}

// ============================================
// Vehicles API
// ============================================

export interface Vehicle {
  id: string; designation: string; vehicleType: string; driver: string;
  licensePlate: string; dimensions: string; powerConnection: string;
  hasTrailer: boolean; trailerDimensions: string; trailerLicensePlate: string;
  seats: string; sleepingPlaces: string; notes: string;
  createdAt?: string; updatedAt?: string;
}
export type VehicleFormData = Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>;

export async function getVehicles(): Promise<Vehicle[]> {
  const res = await request<{ vehicles: Vehicle[] }>('/api/vehicles');
  return res.vehicles;
}
export async function createVehicle(data: VehicleFormData): Promise<Vehicle> {
  const res = await request<{ vehicle: Vehicle }>('/api/vehicles', { method: 'POST', body: data });
  return res.vehicle;
}
export async function updateVehicle(id: string, data: VehicleFormData): Promise<Vehicle> {
  const res = await request<{ vehicle: Vehicle }>(`/api/vehicles/${id}`, { method: 'PUT', body: data });
  return res.vehicle;
}
export async function deleteVehicle(id: string): Promise<void> {
  await request(`/api/vehicles/${id}`, { method: 'DELETE' });
}

// ============================================
// Partners API
// ============================================

export interface Partner {
  id: string; type: string; companyName: string; street: string; postalCode: string;
  city: string; state: string; country: string; contactPerson: string;
  email: string; phone: string; taxId: string; billingAddress: string; notes: string;
  createdAt?: string; updatedAt?: string;
}
export type PartnerFormData = Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>;

export async function getPartners(): Promise<Partner[]> {
  const res = await request<{ partners: Partner[] }>('/api/partners');
  return res.partners;
}
export async function createPartner(data: PartnerFormData): Promise<Partner> {
  const res = await request<{ partner: Partner }>('/api/partners', { method: 'POST', body: data });
  return res.partner;
}
export async function updatePartner(id: string, data: PartnerFormData): Promise<Partner> {
  const res = await request<{ partner: Partner }>(`/api/partners/${id}`, { method: 'PUT', body: data });
  return res.partner;
}
export async function deletePartner(id: string): Promise<void> {
  await request(`/api/partners/${id}`, { method: 'DELETE' });
}

// ============================================
// Termine API
// ============================================

export interface TerminAvailability {
  id: number;
  terminId: number;
  userId: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  status: 'available' | 'maybe' | 'unavailable' | null;
  comment?: string;
  updatedAt: string;
}

export const TERMIN_ART = ['Konzert', 'Auftritt', 'Tour', 'Festival', 'Support', 'Feature', 'Preview', 'Probe', 'Reise', 'Off', 'Vorbereitung', 'Nachbereitung', 'Aufbau', 'Abbau', 'Promo'] as const;
export const TERMIN_ART_SUB = ['Club', 'Halle', 'Arena', 'Open Air', 'Zelt', 'Stadion'] as const;
export const TERMIN_STATUS_BOOKING = ['Idee', 'Option', 'noch nicht bestätigt', 'bestätigt', 'abgeschlossen', 'abgesagt'] as const;
export const TERMIN_STATUS_PUBLIC = ['nicht öffentlich', 'tba', 'veröffentlicht'] as const;

export interface Termin {
  id: number;
  tenantId: number;
  date: string;
  title: string;
  art?: string;
  artSub?: string;
  statusBooking?: string;
  statusPublic?: string;
  showTitleAsHeader?: boolean;
  city?: string;
  venueId?: number;
  venueName?: string;
  partnerId?: number;
  partnerName?: string;
  announcement?: string;
  capacity?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  myAvailability?: 'available' | 'maybe' | 'unavailable' | null;
  myComment?: string;
  inTravelParty?: boolean;
  isRejected?: boolean;
  availability?: TerminAvailability[];
}

export type TerminFormData = {
  date: string;
  title: string;
  art?: string;
  art_sub?: string;
  status_booking?: string;
  status_public?: string;
  show_title_as_header?: boolean;
  city?: string;
  venue_id?: number | null;
  partner_id?: number | null;
  announcement?: string;
  capacity?: number | null;
  notes?: string;
};

function terminFromRow(row: Record<string, unknown>): Termin {
  return {
    id: row.id as number,
    tenantId: row.tenant_id as number,
    date: row.date as string,
    title: row.title as string,
    art: row.art as string | undefined,
    artSub: row.art_sub as string | undefined,
    statusBooking: row.status_booking as string | undefined,
    statusPublic: row.status_public as string | undefined,
    showTitleAsHeader: Boolean(row.show_title_as_header),
    city: row.city as string | undefined,
    venueId: row.venue_id as number | undefined,
    venueName: row.venue_name as string | undefined,
    partnerId: row.partner_id as number | undefined,
    partnerName: row.partner_name as string | undefined,
    announcement: row.announcement as string | undefined,
    capacity: row.capacity as number | undefined,
    notes: row.notes as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    myAvailability: (row.my_availability as 'available' | 'maybe' | 'unavailable' | null) ?? null,
    myComment: row.my_comment as string | undefined,
    inTravelParty: Boolean(row.in_travel_party),
    isRejected: Boolean(row.is_rejected),
    availability: ((row.availability as any[] | undefined) ?? []).map((a: any) => ({
      id: a.id,
      terminId: a.termin_id,
      userId: a.user_id,
      firstName: a.first_name,
      lastName: a.last_name,
      email: a.email,
      status: a.status ?? null,
      comment: a.comment,
      updatedAt: a.updated_at,
    } as TerminAvailability)),
  };
}

export async function getTermine(): Promise<Termin[]> {
  const res = await request<{ termine: Record<string, unknown>[] }>('/api/termine');
  return res.termine.map(terminFromRow);
}

export async function getTermin(id: number): Promise<Termin> {
  const res = await request<{ termin: Record<string, unknown> }>(`/api/termine/${id}`);
  return terminFromRow(res.termin);
}

export async function createTermin(data: TerminFormData): Promise<Termin> {
  const res = await request<{ termin: Record<string, unknown> }>('/api/termine', { method: 'POST', body: data });
  return terminFromRow(res.termin);
}

export async function updateTermin(id: number, data: TerminFormData): Promise<Termin> {
  const res = await request<{ termin: Record<string, unknown> }>(`/api/termine/${id}`, { method: 'PUT', body: data });
  return terminFromRow(res.termin);
}

export async function patchTermin(id: number, data: { show_title_as_header: boolean }): Promise<Termin> {
  const res = await request<{ termin: Record<string, unknown> }>(`/api/termine/${id}`, { method: 'PATCH', body: data });
  return terminFromRow(res.termin);
}

export async function deleteTermin(id: number): Promise<void> {
  await request(`/api/termine/${id}`, { method: 'DELETE' });
}

export async function setAvailability(
  terminId: number,
  status: 'available' | 'maybe' | 'unavailable' | null,
  comment?: string
): Promise<{ availability: { id: number; termin_id: number; user_id: number; status: string | null; comment: string | null; booked_status: string | null; updated_at: string } }> {
  return request(`/api/termine/${terminId}/availability`, {
    method: 'PUT',
    body: { status, comment },
  }) as Promise<{ availability: { id: number; termin_id: number; user_id: number; status: string | null; comment: string | null; booked_status: string | null; updated_at: string } }>;
}


// ============================================
// Termin Contacts API
// ============================================

export interface TerminContact {
  id: number;
  terminId: number;
  tenantId: number;
  label: string;
  firstName: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  sortOrder: number;
}

export type TerminContactFormData = Omit<TerminContact, 'id' | 'terminId' | 'tenantId'>;

function contactFromRow(r: Record<string, unknown>): TerminContact {
  return {
    id: r.id as number,
    terminId: r.termin_id as number,
    tenantId: r.tenant_id as number,
    label: (r.label as string) ?? '',
    firstName: (r.first_name as string) ?? '',
    name: (r.name as string) ?? '',
    phone: (r.phone as string) ?? '',
    email: (r.email as string) ?? '',
    notes: (r.notes as string) ?? '',
    sortOrder: (r.sort_order as number) ?? 0,
  };
}

export async function getTerminContacts(terminId: number): Promise<TerminContact[]> {
  const res = await request<{ contacts: Record<string, unknown>[] }>(`/api/termine/${terminId}/contacts`);
  return res.contacts.map(contactFromRow);
}

export async function createTerminContact(terminId: number, data: TerminContactFormData): Promise<TerminContact> {
  const res = await request<{ contact: Record<string, unknown> }>(`/api/termine/${terminId}/contacts`, {
    method: 'POST',
    body: { label: data.label, first_name: data.firstName, name: data.name, phone: data.phone, email: data.email, notes: data.notes, sort_order: data.sortOrder },
  });
  return contactFromRow(res.contact);
}

export async function updateTerminContact(terminId: number, id: number, data: TerminContactFormData): Promise<TerminContact> {
  const res = await request<{ contact: Record<string, unknown> }>(`/api/termine/${terminId}/contacts/${id}`, {
    method: 'PUT',
    body: { label: data.label, first_name: data.firstName, name: data.name, phone: data.phone, email: data.email, notes: data.notes, sort_order: data.sortOrder },
  });
  return contactFromRow(res.contact);
}

export async function deleteTerminContact(terminId: number, id: number): Promise<void> {
  await request(`/api/termine/${terminId}/contacts/${id}`, { method: 'DELETE' });
}

// ============================================
// Termin Travel Party API (Reisegruppe)
// ============================================

export type AvailabilityStatus = 'available' | 'maybe' | 'unavailable' | null;

export interface TravelPartyMember {
  id: number;
  terminId: number;
  tenantId: number;
  contactId: number;
  // termin-specific
  role1: string;
  role2: string;
  role3: string;
  specification: string;
  sortOrder: number;
  // live from contact
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  postalCode: string;
  residence: string;
  function1: string;
  function2: string;
  function3: string;
  userId: number | null;
  contactType: 'crew' | 'guest';
  availabilityStatus: AvailabilityStatus;
}

export interface TravelPartyPickerContact {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  postalCode: string;
  residence: string;
  function1: string;
  function2: string;
  function3: string;
  userId: number | null;
  contactType: 'crew' | 'guest';
  availabilityStatus: AvailabilityStatus;
  alreadyAdded: boolean;
}

function memberFromRow(r: Record<string, unknown>): TravelPartyMember {
  return {
    id: r.id as number,
    terminId: r.termin_id as number,
    tenantId: r.tenant_id as number,
    contactId: r.contact_id as number,
    role1: (r.role1 as string) ?? '',
    role2: (r.role2 as string) ?? '',
    role3: (r.role3 as string) ?? '',
    specification: (r.specification as string) ?? '',
    sortOrder: (r.sort_order as number) ?? 0,
    firstName: (r.first_name as string) ?? '',
    lastName: (r.last_name as string) ?? '',
    email: (r.email as string) ?? '',
    phone: (r.phone as string) ?? '',
    mobile: (r.mobile as string) ?? '',
    postalCode: (r.postal_code as string) ?? '',
    residence: (r.residence as string) ?? '',
    function1: (r.function1 as string) ?? '',
    function2: (r.function2 as string) ?? '',
    function3: (r.function3 as string) ?? '',
    userId: (r.user_id as number) ?? null,
    contactType: ((r.contact_type as string) ?? 'crew') as 'crew' | 'guest',
    availabilityStatus: (r.availability_status as AvailabilityStatus) ?? null,
  };
}

export async function createGuestTravelPartyMember(
  terminId: number,
  data: {
    firstName: string; lastName: string; phone?: string;
    function1?: string; function2?: string; function3?: string;
    specification?: string; diet?: string; allergies?: string;
    glutenFree?: boolean; lactoseFree?: boolean; notes?: string;
  }
): Promise<TravelPartyMember> {
  const res = await request<{ member: Record<string, unknown> }>(
    `/api/termine/${terminId}/travel-party/guest`,
    {
      method: 'POST',
      body: {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone ?? '',
        function1: data.function1 ?? '',
        function2: data.function2 ?? '',
        function3: data.function3 ?? '',
        specification: data.specification ?? '',
        diet: data.diet ?? '',
        allergies: data.allergies ?? '',
        gluten_free: data.glutenFree ? 1 : 0,
        lactose_free: data.lactoseFree ? 1 : 0,
        notes: data.notes ?? '',
      },
    }
  );
  return memberFromRow(res.member);
}

type GuestContactData = {
  firstName: string; lastName: string; phone?: string;
  function1?: string; function2?: string; function3?: string;
  specification?: string; diet?: string; allergies?: string;
  glutenFree?: boolean; lactoseFree?: boolean; notes?: string;
}

export async function createGuestContact(data: GuestContactData): Promise<Contact> {
  const res = await request<{ contact: Record<string, unknown> }>(
    `/api/contacts/guest`,
    { method: 'POST', body: data }
  );
  return contactFromRow(res.contact) as unknown as Contact;
}

function pickerContactFromRow(r: Record<string, unknown>): TravelPartyPickerContact {
  return {
    id: r.id as number,
    firstName: (r.first_name as string) ?? '',
    lastName: (r.last_name as string) ?? '',
    email: (r.email as string) ?? '',
    phone: (r.phone as string) ?? '',
    mobile: (r.mobile as string) ?? '',
    postalCode: (r.postal_code as string) ?? '',
    residence: (r.residence as string) ?? '',
    function1: (r.function1 as string) ?? '',
    function2: (r.function2 as string) ?? '',
    function3: (r.function3 as string) ?? '',
    userId: (r.user_id as number) ?? null,
    contactType: ((r.contact_type as string) ?? 'crew') as 'crew' | 'guest',
    availabilityStatus: (r.availability_status as AvailabilityStatus) ?? null,
    alreadyAdded: Boolean(r.already_added),
  };
}

export async function getTravelParty(terminId: number): Promise<TravelPartyMember[]> {
  const res = await request<{ members: Record<string, unknown>[] }>(`/api/termine/${terminId}/travel-party`);
  return res.members.map(memberFromRow);
}

export async function getTravelPartyPicker(terminId: number): Promise<TravelPartyPickerContact[]> {
  const res = await request<{ contacts: Record<string, unknown>[] }>(`/api/termine/${terminId}/travel-party/picker`);
  return res.contacts.map(pickerContactFromRow);
}

export async function addTravelPartyMember(
  terminId: number,
  data: { contactId: number; role1?: string; role2?: string; role3?: string; specification?: string; sortOrder?: number }
): Promise<TravelPartyMember> {
  const res = await request<{ member: Record<string, unknown> }>(`/api/termine/${terminId}/travel-party`, {
    method: 'POST',
    body: {
      contact_id: data.contactId,
      role1: data.role1 ?? '',
      role2: data.role2 ?? '',
      role3: data.role3 ?? '',
      specification: data.specification ?? '',
      sort_order: data.sortOrder ?? 0,
    },
  });
  return memberFromRow(res.member);
}

export async function updateTravelPartyMember(
  terminId: number,
  id: number,
  data: { role1?: string; role2?: string; role3?: string; specification?: string; sortOrder?: number }
): Promise<TravelPartyMember> {
  const res = await request<{ member: Record<string, unknown> }>(`/api/termine/${terminId}/travel-party/${id}`, {
    method: 'PUT',
    body: {
      role1: data.role1 ?? '',
      role2: data.role2 ?? '',
      role3: data.role3 ?? '',
      specification: data.specification ?? '',
      sort_order: data.sortOrder,
    },
  });
  return memberFromRow(res.member);
}

export async function deleteTravelPartyMember(terminId: number, id: number): Promise<void> {
  await request(`/api/termine/${terminId}/travel-party/${id}`, { method: 'DELETE' });
}

export async function removeTravelPartyMemberByContact(terminId: number, contactId: number): Promise<void> {
  await request(`/api/termine/${terminId}/travel-party/by-contact/${contactId}`, { method: 'DELETE' });
}

export async function addTravelPartyRole(terminId: number, contactId: number, role: string): Promise<void> {
  await request(`/api/termine/${terminId}/travel-party/add-role`, {
    method: 'POST',
    body: { contact_id: contactId, role },
  });
}

export async function removeTravelPartyRole(terminId: number, contactId: number, role: string): Promise<void> {
  await request(`/api/termine/${terminId}/travel-party/by-contact/${contactId}/role/${encodeURIComponent(role)}`, {
    method: 'DELETE',
  });
}

// ── Booking Rejections ────────────────────────────────────────────────────────

export async function getBookingRejections(terminId: number): Promise<number[]> {
  const res = await request<{ rejections: number[] }>(`/api/termine/${terminId}/booking-rejections`)
  return res.rejections
}

export async function addBookingRejection(terminId: number, contactId: number): Promise<void> {
  await request(`/api/termine/${terminId}/booking-rejections/${contactId}`, { method: 'POST' })
}

export async function removeBookingRejection(terminId: number, contactId: number): Promise<void> {
  await request(`/api/termine/${terminId}/booking-rejections/${contactId}`, { method: 'DELETE' })
}

// ============================================================
// Settings – Function catalog
// ============================================================

export interface FunctionCatalogGroup {
  group: string;
  functions: { name: string; active: boolean }[];
}

export interface ActiveFunction {
  name: string;
  group: string;
}

export async function getFunctionCatalog(): Promise<FunctionCatalogGroup[]> {
  const res = await request<{ catalog: FunctionCatalogGroup[] }>('/api/settings/functions');
  return res.catalog;
}

export async function saveFunctionCatalog(activeNames: string[]): Promise<void> {
  await request('/api/settings/functions', {
    method: 'PUT',
    body: { active_functions: activeNames },
  });
}

export async function getActiveFunctions(): Promise<ActiveFunction[]> {
  const res = await request<{ functions: ActiveFunction[] }>('/api/settings/functions/active');
  return res.functions;
}

// ============================================
// Termin Schedules API
// ============================================

export interface TerminSchedule {
  id: number;
  terminId: number;
  tenantId: number;
  title: string;
  content: string;
  notFinal: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type TerminScheduleFormData = Omit<TerminSchedule, 'id' | 'terminId' | 'tenantId' | 'createdAt' | 'updatedAt'>;

function scheduleFromRow(r: Record<string, unknown>): TerminSchedule {
  return {
    id: r.id as number,
    terminId: r.termin_id as number,
    tenantId: r.tenant_id as number,
    title: (r.title as string) ?? '',
    content: (r.content as string) ?? '',
    notFinal: Boolean(r.not_final),
    sortOrder: (r.sort_order as number) ?? 0,
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

export async function getTerminSchedules(terminId: number): Promise<TerminSchedule[]> {
  const res = await request<{ schedules: Record<string, unknown>[] }>(`/api/termine/${terminId}/schedules`);
  return res.schedules.map(scheduleFromRow);
}

export async function createTerminSchedule(terminId: number, data: TerminScheduleFormData): Promise<TerminSchedule> {
  const res = await request<{ schedule: Record<string, unknown> }>(`/api/termine/${terminId}/schedules`, {
    method: 'POST',
    body: { title: data.title, content: data.content, not_final: data.notFinal ? 1 : 0, sort_order: data.sortOrder },
  });
  return scheduleFromRow(res.schedule);
}

export async function updateTerminSchedule(terminId: number, id: number, data: TerminScheduleFormData): Promise<TerminSchedule> {
  const res = await request<{ schedule: Record<string, unknown> }>(`/api/termine/${terminId}/schedules/${id}`, {
    method: 'PUT',
    body: { title: data.title, content: data.content, not_final: data.notFinal ? 1 : 0, sort_order: data.sortOrder },
  });
  return scheduleFromRow(res.schedule);
}

export async function deleteTerminSchedule(terminId: number, id: number): Promise<void> {
  await request(`/api/termine/${terminId}/schedules/${id}`, { method: 'DELETE' });
}

// ============================================
// BOARDS — generische ContentBoard API
// ============================================

export interface BoardItem {
  id: number;
  tenantId: number;
  entityType: string;
  entityId: string;
  title: string;
  content: string;
  notFinal: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type BoardItemFormData = Pick<BoardItem, 'title' | 'content' | 'notFinal' | 'sortOrder'>;

export async function getBoardItems(entityType: string, entityId: string): Promise<BoardItem[]> {
  const res = await request<{ items: BoardItem[] }>(`/api/boards/${entityType}/${entityId}`);
  return res.items;
}

export async function createBoardItem(entityType: string, entityId: string, data: BoardItemFormData): Promise<BoardItem> {
  const res = await request<{ item: BoardItem }>(`/api/boards/${entityType}/${entityId}`, {
    method: 'POST', body: data,
  });
  return res.item;
}

export async function updateBoardItem(entityType: string, entityId: string, id: number, data: BoardItemFormData): Promise<BoardItem> {
  const res = await request<{ item: BoardItem }>(`/api/boards/${entityType}/${entityId}/${id}`, {
    method: 'PUT', body: data,
  });
  return res.item;
}

export async function deleteBoardItem(entityType: string, entityId: string, id: number): Promise<void> {
  await request(`/api/boards/${entityType}/${entityId}/${id}`, { method: 'DELETE' });
}

// ============================================
// USER PROFILE (/api/me)
// ============================================

export interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  mobile: string;
  address: string;
  postalCode: string;
  residence: string;
  birthDate: string;
  gender: string;
  pronouns: string;
  birthPlace: string;
  nationality: string;
  idNumber: string;
  taxId: string;
  socialSecurity: string;
  taxNumber: string;
  vatId: string;
  diet: string;
  glutenFree: boolean;
  lactoseFree: boolean;
  allergies: string;
  specialNotes: string;
  emergencyContact: string;
  emergencyPhone: string;
  shirtSize: string;
  hoodieSize: string;
  pantsSize: string;
  shoeSize: string;
  hotelInfo: string;
  hotelAlias: string;
  languages: string;
  driversLicense: string;
  railcard: string;
  frequentFlyer: string;
  bankAccount: string;
  bankIban: string;
  bankBic: string;
  website: string;
}

function userProfileFromRow(r: Record<string, unknown>): UserProfile {
  const s = (v: unknown) => (v as string) ?? '';
  return {
    id: r.id as number,
    email: s(r.email),
    firstName: s(r.first_name),
    lastName: s(r.last_name),
    phone: s(r.phone),
    mobile: s(r.mobile),
    address: s(r.address),
    postalCode: s(r.postal_code),
    residence: s(r.residence),
    birthDate: s(r.birth_date),
    gender: s(r.gender),
    pronouns: s(r.pronouns),
    birthPlace: s(r.birth_place),
    nationality: s(r.nationality),
    idNumber: s(r.id_number),
    taxId: s(r.tax_id),
    socialSecurity: s(r.social_security),
    taxNumber: s(r.tax_number),
    vatId: s(r.vat_id),
    diet: s(r.diet),
    glutenFree: Boolean(r.gluten_free),
    lactoseFree: Boolean(r.lactose_free),
    allergies: s(r.allergies),
    specialNotes: s(r.special_notes),
    emergencyContact: s(r.emergency_contact),
    emergencyPhone: s(r.emergency_phone),
    shirtSize: s(r.shirt_size),
    hoodieSize: s(r.hoodie_size),
    pantsSize: s(r.pants_size),
    shoeSize: s(r.shoe_size),
    hotelInfo: s(r.hotel_info),
    hotelAlias: s(r.hotel_alias),
    languages: s(r.languages),
    driversLicense: s(r.drivers_license),
    railcard: s(r.railcard),
    frequentFlyer: s(r.frequent_flyer),
    bankAccount: s(r.bank_account),
    bankIban: s(r.bank_iban),
    bankBic: s(r.bank_bic),
    website: s(r.website),
  };
}

export async function getMe(): Promise<UserProfile> {
  const res = await request<{ user: Record<string, unknown> }>('/api/me');
  return userProfileFromRow(res.user);
}

export async function updateMe(data: Omit<UserProfile, 'id' | 'email'>): Promise<UserProfile> {
  const res = await request<{ user: Record<string, unknown> }>('/api/me', {
    method: 'PUT',
    body: {
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      mobile: data.mobile,
      address: data.address,
      postal_code: data.postalCode,
      residence: data.residence,
      birth_date: data.birthDate,
      gender: data.gender,
      pronouns: data.pronouns,
      birth_place: data.birthPlace,
      nationality: data.nationality,
      id_number: data.idNumber,
      tax_id: data.taxId,
      social_security: data.socialSecurity,
      tax_number: data.taxNumber,
      vat_id: data.vatId,
      diet: data.diet,
      gluten_free: data.glutenFree ? 1 : 0,
      lactose_free: data.lactoseFree ? 1 : 0,
      allergies: data.allergies,
      special_notes: data.specialNotes,
      emergency_contact: data.emergencyContact,
      emergency_phone: data.emergencyPhone,
      shirt_size: data.shirtSize,
      hoodie_size: data.hoodieSize,
      pants_size: data.pantsSize,
      shoe_size: data.shoeSize,
      hotel_info: data.hotelInfo,
      hotel_alias: data.hotelAlias,
      languages: data.languages,
      drivers_license: data.driversLicense,
      railcard: data.railcard,
      frequent_flyer: data.frequentFlyer,
      bank_account: data.bankAccount,
      bank_iban: data.bankIban,
      bank_bic: data.bankBic,
      website: data.website,
    },
  });
  return userProfileFromRow(res.user);
}

// ============================================
// Travel Legs API (Anreise / Abreise / Weiterreise)
// ============================================

export type LegType = 'anreise' | 'abreise' | 'weiterreise';
export type TransportType = 'fahrzeug' | 'bahn' | 'flugzeug' | 'sonstiges';

export interface TravelLegPerson {
  id: number;
  legId: number;
  travelPartyMemberId: number;
  firstName: string;
  lastName: string;
  role1: string;
}

export interface TravelLeg {
  id: number;
  terminId: number;
  tenantId: number;
  legType: LegType;
  transportType: TransportType;
  vehicleId: string | null;
  vehicleLabel: string | null;
  departureLocation: string;
  arrivalLocation: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  distanceKm: number | null;
  travelDurationMin: number | null;
  trainNumber: string;
  bookingCode: string;
  platform: string;
  flightNumber: string;
  terminal: string;
  otherTransport: string;   // Beschreibung bei transportType = 'sonstiges'
  notes: string;
  visibility: 'all' | 'admin';
  sortOrder: number;
  persons: TravelLegPerson[];
}

export type TravelLegFormData = Omit<TravelLeg, 'id' | 'terminId' | 'tenantId' | 'vehicleLabel' | 'persons'>;

function legPersonFromRow(r: Record<string, unknown>): TravelLegPerson {
  return {
    id: r.id as number,
    legId: r.leg_id as number,
    travelPartyMemberId: r.travel_party_member_id as number,
    firstName: (r.first_name as string) ?? '',
    lastName: (r.last_name as string) ?? '',
    role1: (r.role1 as string) ?? '',
  };
}

function legFromRow(r: Record<string, unknown>): TravelLeg {
  const persons = Array.isArray(r.persons)
    ? (r.persons as Record<string, unknown>[]).map(legPersonFromRow)
    : [];
  // bookingCode: server stores train/flight-specific fields; unify here
  const bookingCode = (r.train_booking_code as string)
    || (r.flight_booking_code as string)
    || '';
  return {
    id: r.id as number,
    terminId: r.termin_id as number,
    tenantId: r.tenant_id as number,
    legType: (r.leg_type as LegType) ?? 'anreise',
    transportType: (r.transport_type as TransportType) ?? 'fahrzeug',
    vehicleId: r.vehicle_id != null ? String(r.vehicle_id) : null,
    vehicleLabel: (r.vehicle_designation as string) ?? null,      // JOIN alias
    departureLocation: (r.from_location as string) ?? '',          // DB column
    arrivalLocation: (r.to_location as string) ?? '',              // DB column
    departureDate: (r.departure_date as string) ?? '',
    departureTime: (r.departure_time as string) ?? '',
    arrivalDate: (r.arrival_date as string) ?? '',
    arrivalTime: (r.arrival_time as string) ?? '',
    distanceKm: r.distance_km != null ? Number(r.distance_km) : null,
    travelDurationMin: r.travel_time_minutes != null ? Number(r.travel_time_minutes) : null, // DB column
    trainNumber: (r.train_number as string) ?? '',
    bookingCode,
    platform: (r.train_platform as string) ?? '',                  // DB column
    flightNumber: (r.flight_number as string) ?? '',
    terminal: (r.flight_terminal as string) ?? '',                 // DB column
    otherTransport: (r.other_transport as string) ?? '',
    notes: (r.notes as string) ?? '',
    visibility: (r.visibility_restricted ? 'admin' : 'all') as 'all' | 'admin', // DB column
    sortOrder: (r.sort_order as number) ?? 0,
    persons,
  };
}

export async function getTravelLegs(terminId: number): Promise<TravelLeg[]> {
  const res = await request<{ legs: Record<string, unknown>[] }>(`/api/termine/${terminId}/travel-legs`);
  return res.legs.map(legFromRow);
}

function legToBody(data: TravelLegFormData) {
  return {
    leg_type: data.legType,
    transport_type: data.transportType,
    vehicle_id: data.vehicleId ?? null,
    from_location: data.departureLocation,           // DB column
    to_location: data.arrivalLocation,               // DB column
    departure_date: data.departureDate,
    departure_time: data.departureTime,
    arrival_date: data.arrivalDate,
    arrival_time: data.arrivalTime,
    distance_km: data.distanceKm ?? null,
    travel_time_minutes: data.travelDurationMin ?? null, // DB column
    train_number: data.trainNumber,
    train_booking_code: data.transportType === 'bahn' ? data.bookingCode : '',
    train_platform: data.platform,                   // DB column
    flight_number: data.flightNumber,
    flight_booking_code: data.transportType === 'flugzeug' ? data.bookingCode : '',
    flight_terminal: data.terminal,                  // DB column
    other_transport: data.otherTransport,
    notes: data.notes,
    visibility_restricted: data.visibility === 'admin' ? 1 : 0, // DB column
    sort_order: data.sortOrder,
  };
}

export async function createTravelLeg(terminId: number, data: TravelLegFormData): Promise<TravelLeg> {
  const res = await request<{ leg: Record<string, unknown> }>(`/api/termine/${terminId}/travel-legs`, {
    method: 'POST',
    body: legToBody(data),
  });
  return legFromRow(res.leg);
}

export async function updateTravelLeg(terminId: number, legId: number, data: TravelLegFormData): Promise<TravelLeg> {
  const res = await request<{ leg: Record<string, unknown> }>(`/api/termine/${terminId}/travel-legs/${legId}`, {
    method: 'PUT',
    body: legToBody(data),
  });
  return legFromRow(res.leg);
}

export async function deleteTravelLeg(terminId: number, legId: number): Promise<void> {
  await request(`/api/termine/${terminId}/travel-legs/${legId}`, { method: 'DELETE' });
}

export async function updateTravelLegPersons(terminId: number, legId: number, memberIds: number[]): Promise<TravelLeg> {
  const res = await request<{ leg: Record<string, unknown> }>(`/api/termine/${terminId}/travel-legs/${legId}/persons`, {
    method: 'PUT',
    body: { member_ids: memberIds },
  });
  return legFromRow(res.leg);
}

// ============================================
// Hotel Stays API
// ============================================

export type RoomType =
  | 'einzelzimmer'
  | 'doppelzimmer'
  | 'twin'
  | 'suite'
  | 'duschzimmer'
  | 'sonstiges'

export interface HotelRoomPerson {
  id: number
  travelPartyMemberId: number
  firstName: string
  lastName: string
  role1: string
}

// Ein einzelnes Zimmer innerhalb eines Stays
export interface HotelRoom {
  id: number
  stayId: number
  roomType: RoomType
  roomLabel: string
  persons: HotelRoomPerson[]
}

// Ein Hotel-Aufenthalt mit n Zimmern
export interface HotelStay {
  id: number
  terminId: number
  hotelId: number | null
  hotelName: string
  hotelCity: string
  hotelStreet: string
  hotelPostalCode: string
  hotelPhone: string
  hotelEmail: string
  hotelWebsite: string
  hotelCheckIn: string   // Standard-Zeiten aus Hotelstamm
  hotelCheckOut: string
  checkInDate: string
  checkOutDate: string
  bookingCode: string
  notes: string
  visibility: 'all' | 'admin'
  sortOrder: number
  rooms: HotelRoom[]
}

// Für das Formular: Zimmer noch ohne DB-IDs
export interface HotelRoomDraft {
  roomType: RoomType
  roomLabel: string
  memberIds: number[]
}

export interface HotelStayFormData {
  hotelId: number | null
  checkInDate: string
  checkOutDate: string
  bookingCode: string
  notes: string
  visibility: 'all' | 'admin'
  sortOrder: number
  rooms: HotelRoomDraft[]
}

function roomPersonFromRow(p: Record<string, unknown>): HotelRoomPerson {
  return {
    id: p.id as number,
    travelPartyMemberId: p.travel_party_member_id as number,
    firstName: (p.first_name as string) ?? '',
    lastName: (p.last_name as string) ?? '',
    role1: (p.role1 as string) ?? '',
  }
}

function hotelRoomFromRow(r: Record<string, unknown>): HotelRoom {
  return {
    id: r.id as number,
    stayId: r.stay_id as number,
    roomType: (r.room_type as RoomType) ?? 'einzelzimmer',
    roomLabel: (r.room_label as string) ?? '',
    persons: Array.isArray(r.persons)
      ? (r.persons as Record<string, unknown>[]).map(roomPersonFromRow)
      : [],
  }
}

function hotelStayFromRow(r: Record<string, unknown>): HotelStay {
  const s = (v: unknown) => (v as string) ?? ''
  return {
    id: r.id as number,
    terminId: r.termin_id as number,
    hotelId: r.hotel_id != null ? Number(r.hotel_id) : null,
    hotelName: s(r.hotel_name),
    hotelCity: s(r.hotel_city),
    hotelStreet: s(r.hotel_street),
    hotelPostalCode: s(r.hotel_postal_code),
    hotelPhone: s(r.hotel_phone),
    hotelEmail: s(r.hotel_email),
    hotelWebsite: s(r.hotel_website),
    hotelCheckIn: s(r.hotel_check_in),
    hotelCheckOut: s(r.hotel_check_out),
    checkInDate: s(r.check_in_date),
    checkOutDate: s(r.check_out_date),
    bookingCode: s(r.booking_code),
    notes: s(r.notes),
    visibility: r.visibility_restricted ? 'admin' : 'all',
    sortOrder: (r.sort_order as number) ?? 0,
    rooms: Array.isArray(r.rooms)
      ? (r.rooms as Record<string, unknown>[]).map(hotelRoomFromRow)
      : [],
  }
}

function stayToBody(data: HotelStayFormData) {
  return {
    hotel_id: data.hotelId ?? null,
    check_in_date: data.checkInDate,
    check_out_date: data.checkOutDate,
    booking_code: data.bookingCode,
    notes: data.notes,
    visibility_restricted: data.visibility === 'admin' ? 1 : 0,
    sort_order: data.sortOrder,
  }
}

function roomsToBody(rooms: HotelRoomDraft[]) {
  return rooms.map(r => ({
    room_type: r.roomType,
    room_label: r.roomLabel,
    member_ids: r.memberIds,
  }))
}

export async function getHotelStays(terminId: number): Promise<HotelStay[]> {
  const res = await request<{ stays: Record<string, unknown>[] }>(`/api/termine/${terminId}/hotel-stays`)
  return res.stays.map(hotelStayFromRow)
}

export async function createHotelStay(terminId: number, data: HotelStayFormData): Promise<HotelStay> {
  const res = await request<{ stay: Record<string, unknown> }>(`/api/termine/${terminId}/hotel-stays`, {
    method: 'POST',
    body: stayToBody(data),
  })
  const stay = hotelStayFromRow(res.stay)
  // Zimmer separat synchen
  return syncHotelStayRooms(terminId, stay.id, data.rooms)
}

export async function updateHotelStay(terminId: number, stayId: number, data: HotelStayFormData): Promise<HotelStay> {
  const res = await request<{ stay: Record<string, unknown> }>(`/api/termine/${terminId}/hotel-stays/${stayId}`, {
    method: 'PUT',
    body: stayToBody(data),
  })
  hotelStayFromRow(res.stay) // nur für Fehlercheck
  return syncHotelStayRooms(terminId, stayId, data.rooms)
}

export async function deleteHotelStay(terminId: number, stayId: number): Promise<void> {
  await request(`/api/termine/${terminId}/hotel-stays/${stayId}`, { method: 'DELETE' })
}

export async function syncHotelStayRooms(terminId: number, stayId: number, rooms: HotelRoomDraft[]): Promise<HotelStay> {
  const res = await request<{ stay: Record<string, unknown> }>(`/api/termine/${terminId}/hotel-stays/${stayId}/rooms`, {
    method: 'PUT',
    body: { rooms: roomsToBody(rooms) },
  })
  return hotelStayFromRow(res.stay)
}

// ============================================================
// TODOS
// ============================================================

export type TodoStatus   = 'open' | 'in_progress' | 'done'
export type TodoPriority = 'high' | 'medium' | 'low'

export interface Todo {
  id: number
  tenantId: number
  terminId: number
  title: string
  description: string | null
  status: TodoStatus
  priority: TodoPriority
  assignedContactId: number | null
  assignedFirstName: string | null
  assignedLastName:  string | null
  deadline: string | null
  createdByUserId: number | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  // nur im globalen Endpunkt
  terminTitle?: string
  terminDate?:  string
  terminCity?:  string
}

export interface TodoFormData {
  title: string
  description?: string
  status?: TodoStatus
  priority?: TodoPriority
  assignedContactId?: number | null
  deadline?: string | null
}

function todoFromRow(r: Record<string, unknown>): Todo {
  return {
    id:                 r.id as number,
    tenantId:           r.tenant_id as number,
    terminId:           r.termin_id as number,
    title:              (r.title as string) ?? '',
    description:        (r.description as string | null) ?? null,
    status:             (r.status as TodoStatus) ?? 'open',
    priority:           (r.priority as TodoPriority) ?? 'medium',
    assignedContactId:  (r.assigned_contact_id as number | null) ?? null,
    assignedFirstName:  (r.assigned_first_name as string | null) ?? null,
    assignedLastName:   (r.assigned_last_name  as string | null) ?? null,
    deadline:           (r.deadline as string | null) ?? null,
    createdByUserId:    (r.created_by_user_id as number | null) ?? null,
    sortOrder:          (r.sort_order as number) ?? 0,
    createdAt:          (r.created_at as string) ?? '',
    updatedAt:          (r.updated_at as string) ?? '',
    terminTitle:        (r.termin_title as string | undefined),
    terminDate:         (r.termin_date  as string | undefined),
    terminCity:         (r.termin_city  as string | undefined),
  }
}

export async function getTodos(terminId: number): Promise<Todo[]> {
  const rows = await request<Record<string, unknown>[]>(`/api/termine/${terminId}/todos`)
  return rows.map(todoFromRow)
}

export async function createTodo(terminId: number, data: TodoFormData): Promise<Todo> {
  const row = await request<Record<string, unknown>>(`/api/termine/${terminId}/todos`, {
    method: 'POST',
    body: {
      title:              data.title,
      description:        data.description ?? null,
      status:             data.status ?? 'open',
      priority:           data.priority ?? 'medium',
      assignedContactId:  data.assignedContactId ?? null,
      deadline:           data.deadline ?? null,
    },
  })
  return todoFromRow(row)
}

export async function updateTodo(terminId: number, id: number, data: Partial<TodoFormData> & { status?: TodoStatus }): Promise<Todo> {
  const row = await request<Record<string, unknown>>(`/api/termine/${terminId}/todos/${id}`, {
    method: 'PUT',
    body: {
      title:              data.title,
      description:        data.description,
      status:             data.status,
      priority:           data.priority,
      assignedContactId:  data.assignedContactId,
      deadline:           data.deadline,
    },
  })
  return todoFromRow(row)
}

export async function deleteTodo(terminId: number, id: number): Promise<void> {
  await request(`/api/termine/${terminId}/todos/${id}`, { method: 'DELETE' })
}

export async function getAllTodos(): Promise<Todo[]> {
  const rows = await request<Record<string, unknown>[]>('/api/todos')
  return rows.map(todoFromRow)
}

// ── Catering ────────────────────────────────────────────────────────────────

export type CateringType = 'none' | 'inhouse' | 'buyout' | 'order'

export interface CateringMember {
  id: number
  contactId: number
  firstName: string
  lastName: string
  diet: string
  glutenFree: boolean
  lactoseFree: boolean
  allergies: string
  specialNotes: string
}

export interface Catering {
  id: number
  terminId: number
  type: CateringType
  buyoutAmount: number | null
  notes: string | null
  contactName: string | null
  contactPhone: string | null
}

export interface CateringOrder {
  id: number
  terminId: number
  contactId: number | null
  contactName: string | null
  orderText: string
}

export interface CateringData {
  catering: Catering | null
  members: CateringMember[]
}

function cateringFromRow(r: Record<string, unknown>): Catering {
  return {
    id:           r.id as number,
    terminId:     r.termin_id as number,
    type:         (r.type as CateringType) ?? 'none',
    buyoutAmount: (r.buyout_amount as number | null) ?? null,
    notes:        (r.notes as string | null) ?? null,
    contactName:  (r.contact_name as string | null) ?? null,
    contactPhone: (r.contact_phone as string | null) ?? null,
  }
}

function cateringMemberFromRow(r: Record<string, unknown>): CateringMember {
  return {
    id:          r.id as number,
    contactId:   r.contact_id as number,
    firstName:   (r.first_name as string) ?? '',
    lastName:    (r.last_name as string) ?? '',
    diet:        (r.diet as string) ?? '',
    glutenFree:  !!(r.gluten_free),
    lactoseFree: !!(r.lactose_free),
    allergies:   (r.allergies as string) ?? '',
    specialNotes:(r.special_notes as string) ?? '',
  }
}

function cateringOrderFromRow(r: Record<string, unknown>): CateringOrder {
  return {
    id:          r.id as number,
    terminId:    r.termin_id as number,
    contactId:   (r.contact_id as number | null) ?? null,
    contactName: (r.contact_name as string | null) ?? null,
    orderText:   (r.order_text as string) ?? '',
  }
}

export async function getCatering(terminId: number): Promise<CateringData> {
  const data = await request<{ catering: Record<string, unknown> | null; members: Record<string, unknown>[] }>(
    `/api/termine/${terminId}/catering`
  )
  return {
    catering: data.catering ? cateringFromRow(data.catering) : null,
    members:  data.members.map(cateringMemberFromRow),
  }
}

export async function saveCatering(terminId: number, data: Partial<Omit<Catering, 'id' | 'terminId'>>): Promise<Catering> {
  const row = await request<Record<string, unknown>>(`/api/termine/${terminId}/catering`, {
    method: 'PUT',
    body: {
      type:          data.type ?? 'none',
      buyout_amount: data.buyoutAmount ?? null,
      notes:         data.notes ?? null,
      contact_name:  data.contactName ?? null,
      contact_phone: data.contactPhone ?? null,
    },
  })
  return cateringFromRow(row)
}

export async function getCateringOrders(terminId: number): Promise<CateringOrder[]> {
  const rows = await request<Record<string, unknown>[]>(`/api/termine/${terminId}/catering/orders`)
  return rows.map(cateringOrderFromRow)
}

export async function createCateringOrder(terminId: number, data: { contactId?: number | null; contactName?: string; orderText: string }): Promise<CateringOrder> {
  const row = await request<Record<string, unknown>>(`/api/termine/${terminId}/catering/orders`, {
    method: 'POST',
    body: { contact_id: data.contactId ?? null, contact_name: data.contactName ?? null, order_text: data.orderText },
  })
  return cateringOrderFromRow(row)
}

export async function updateCateringOrder(terminId: number, orderId: number, orderText: string): Promise<CateringOrder> {
  const row = await request<Record<string, unknown>>(`/api/termine/${terminId}/catering/orders/${orderId}`, {
    method: 'PUT',
    body: { order_text: orderText },
  })
  return cateringOrderFromRow(row)
}

export async function deleteCateringOrder(terminId: number, orderId: number): Promise<void> {
  await request(`/api/termine/${terminId}/catering/orders/${orderId}`, { method: 'DELETE' })
}

// ============================================
// EINLADUNGEN & BENUTZER-VERWALTUNG
// ============================================

export type TenantRole = 'admin' | 'agency' | 'tourmanagement' | 'artist' | 'crew_plus' | 'crew' | 'guest'

export const ROLE_LABELS: Record<TenantRole, string> = {
  admin:          'Admin',
  agency:         'Agency',
  tourmanagement: 'Tourmanagement',
  artist:         'Artist',
  crew_plus:      'Crew+',
  crew:           'Crew',
  guest:          'Gast',
}

export const ADMIN_ROLES: TenantRole[] = ['admin', 'tourmanagement']

// ── Permission Groups (aus Rollen-Matrix 2026-04-17) ──────────────────────

/** Kann Inhalte bearbeiten (Termine, Kontakte, Hotels, Fahrzeuge etc.) */
export const CAN_EDIT: TenantRole[] = ['admin', 'agency', 'tourmanagement']

/** Alias für CAN_EDIT – Abwärtskompatibilität */
export const EDITOR_ROLES: TenantRole[] = CAN_EDIT

/** Kann Stammdaten anlegen/löschen (Venues, Hotels, Partner) */
export const CAN_MANAGE: TenantRole[] = ['admin', 'agency']

/** Kann neuen Termin anlegen */
export const CAN_CREATE_TERMIN: TenantRole[] = ['admin', 'agency']

/** Kann Ankündigung auf dem Schreibtisch bearbeiten */
export const CAN_EDIT_ANKUENDIGUNG: TenantRole[] = ['admin', 'agency']

/** Sieht globale Todo-Übersicht (alle Todos aller User) */
export const CAN_SEE_TODOS_ALL: TenantRole[] = ['admin', 'tourmanagement', 'agency']

/** Sieht Kalender-View */
export const CAN_SEE_KALENDER: TenantRole[] = ['admin', 'tourmanagement', 'agency', 'artist', 'crew_plus']

/** Sieht Gebucht-Spalte in Terminliste */
export const CAN_SEE_GEBUCHT: TenantRole[] = ['admin', 'tourmanagement', 'agency']

/** Sieht Dateien auf Termin-Detailseite */
export const CAN_SEE_FILES_TERMIN: TenantRole[] = ['admin', 'tourmanagement', 'agency', 'artist', 'crew_plus']

/** Sieht Honorar/Gage-Daten */
export const CAN_SEE_FINANCIALS: TenantRole[] = ['admin', 'tourmanagement', 'agency']

/** Kann Kontakt-Profile öffnen/lesen (über eigenes Profil hinaus) */
export const CAN_SEE_KONTAKT_PROFIL: TenantRole[] = ['admin', 'tourmanagement', 'agency']

/** Navigation: diese Tabs werden je Rolle angezeigt */
export const NAV_VISIBLE: Record<string, TenantRole[]> = {
  desk:         ['admin', 'tourmanagement', 'agency', 'artist', 'crew_plus', 'crew', 'guest'],
  appointments: ['admin', 'tourmanagement', 'agency', 'artist', 'crew_plus', 'crew', 'guest'],
  contacts:     ['admin', 'tourmanagement', 'agency', 'artist', 'crew_plus', 'crew'],
  venues:       ['admin', 'agency'],
  partners:     ['admin', 'agency'],
  hotels:       ['admin', 'tourmanagement', 'agency'],
  vehicles:     ['admin', 'tourmanagement', 'agency'],
  templates:    ['admin', 'tourmanagement', 'agency', 'artist', 'crew_plus', 'crew', 'guest'],
  settings:     ['admin', 'tourmanagement', 'agency'],
  feedback:     ['admin', 'tourmanagement', 'agency', 'artist', 'crew_plus', 'crew', 'guest'],
}

export function canDo(role: string | null | undefined, permission: TenantRole[]): boolean {
  if (!role) return false
  return permission.includes(role as TenantRole)
}

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as TenantRole)
}

export function isEditorRole(role: string): boolean {
  return CAN_EDIT.includes(role as TenantRole)
}

/** Gibt die aktuell wirksame Rolle zurück — Preview-Rolle hat Vorrang */
export function getEffectiveRole(): string {
  return getPreviewRole() ?? getCurrentTenant()?.role ?? ''
}

export interface TenantUser {
  id: number
  email: string
  firstName: string
  lastName: string
  role: TenantRole
  status?: string
  memberStatus?: 'active' | 'inactive'
  joinedAt: string | null
  lastLoginAt?: string | null
  contactId?: number | null
}

export interface PendingInvite {
  id: number
  token: string
  email: string
  role: TenantRole
  firstName?: string
  lastName?: string
  createdAt: string
  expiresAt: string
  invitedBy: number
}

export interface InviteToken {
  token: string
  email: string
  role: TenantRole
  tenantName: string
  tenantSlug: string
  expiresAt: string
  userExists: boolean
  firstName: string
  lastName: string
}

function tenantUserFromRow(r: Record<string, unknown>): TenantUser {
  return {
    id:          r.id as number,
    email:       (r.email as string) ?? '',
    firstName:   (r.first_name as string) ?? '',
    lastName:    (r.last_name as string) ?? '',
    role:        (r.role as TenantRole) ?? 'crew',
    joinedAt:    (r.joined_at as string | null) ?? null,
    lastLoginAt: (r.last_login_at as string | null) ?? null,
    contactId:   (r.contact_id as number | null) ?? null,
  }
}

function pendingInviteFromRow(r: Record<string, unknown>): PendingInvite {
  return {
    id:        r.id as number,
    token:     (r.token as string) ?? '',
    email:     (r.email as string) ?? '',
    role:      (r.role as TenantRole) ?? 'crew',
    firstName: r.firstName as string | undefined,
    lastName:  r.lastName as string | undefined,
    createdAt: (r.created_at as string) ?? '',
    expiresAt: (r.expires_at as string) ?? '',
    invitedBy: (r.invited_by as number) ?? 0,
  }
}

/** Admin: Invite-Link erstellen */
export async function createInvite(email: string, role: TenantRole, contactId?: number): Promise<{ invite_url: string; token: string }> {
  return request('/api/settings/invite', {
    method: 'POST',
    body: { email, role, contact_id: contactId ?? null },
  })
}

/** Öffentlich: Token validieren */
export async function getInviteToken(token: string): Promise<InviteToken> {
  const r = await request<Record<string, unknown>>(`/api/invite/${token}`)
  return {
    token:       (r.token as string),
    email:       (r.email as string) ?? '',
    role:        (r.role as TenantRole) ?? 'crew',
    tenantName:  (r.tenant_name as string) ?? '',
    tenantSlug:  (r.tenant_slug as string) ?? '',
    expiresAt:   (r.expires_at as string) ?? '',
    userExists:  !!(r.user_exists),
    firstName:   (r.first_name as string) ?? '',
    lastName:    (r.last_name as string) ?? '',
  }
}

/** Öffentlich: Einladung annehmen */
export async function acceptInvite(token: string, password?: string, firstName?: string, lastName?: string): Promise<{
  token: string
  user: { id: number; email: string; firstName: string; lastName: string }
  currentTenant: { id: number; name: string; slug: string; status: string; role: string }
}> {
  return request(`/api/invite/${token}/accept`, {
    method: 'POST',
    body: { password: password ?? null, firstName: firstName ?? '', lastName: lastName ?? '' },
    skipTenant: true,
  })
}

/** Admin: User-Liste + offene Einladungen */
export async function getMyRole(): Promise<string> {
  const res = await request('/api/settings/my-role') as { role: string }
  return res.role
}

export async function getSettingsUsers(): Promise<{ users: TenantUser[]; pending: PendingInvite[] }> {
  const data = await request<{ users: Record<string, unknown>[]; pending: Record<string, unknown>[] }>(
    '/api/settings/users'
  )
  return {
    users:   data.users.map(tenantUserFromRow),
    pending: data.pending.map(pendingInviteFromRow),
  }
}

/** Admin: Rolle ändern */
export async function updateUserRole(userId: number, role: TenantRole): Promise<void> {
  await request(`/api/settings/users/${userId}/role`, { method: 'PUT', body: { role } })
}

/** Admin: User entfernen */
export async function removeUser(userId: number): Promise<void> {
  await request(`/api/settings/users/${userId}`, { method: 'DELETE' })
}

/** Admin: Einladung widerrufen */
export async function revokeInvite(tokenId: number): Promise<void> {
  await request(`/api/settings/invites/${tokenId}`, { method: 'DELETE' })
}

/** Admin: User aktivieren/deaktivieren — gibt neuen Status zurück */
export async function adminToggleUserStatus(userId: number): Promise<'active' | 'inactive'> {
  const res = await request<{ status: 'active' | 'inactive' }>(`/api/settings/users/${userId}/status`, { method: 'PUT' })
  return res.status
}

/** Admin: E-Mail eines Users ändern */
export async function adminSetUserEmail(userId: number, email: string): Promise<void> {
  await request(`/api/settings/users/${userId}/email`, { method: 'PUT', body: { email } })
}

/** Admin: Passwort eines Users neu setzen (kein altes PW nötig) */
export async function adminSetUserPassword(userId: number, newPassword: string): Promise<void> {
  await request(`/api/settings/users/${userId}/password`, { method: 'PUT', body: { newPassword } })
}

/** Eigenes Passwort ändern */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request('/api/auth/change-password', {
    method: 'PUT',
    body: { currentPassword, newPassword },
    skipTenant: true,
  })
}

// ============================================
// FEEDBACK
// ============================================

export interface FeedbackItem {
  id: number
  userId: number
  userName: string
  tenantName: string | null
  topic: string
  description: string | null
  private: boolean
  status: 'open' | 'in_progress' | 'done'
  bemerkung: string | null
  createdAt: string
}

function feedbackFromRow(r: Record<string, unknown>): FeedbackItem {
  return {
    id: r.id as number,
    userId: r.user_id as number,
    userName: r.user_name as string,
    tenantName: r.tenant_name as string | null,
    topic: r.topic as string,
    description: r.description as string | null,
    private: Boolean(r.private),
    status: (r.status as 'open' | 'in_progress' | 'done') || 'open',
    bemerkung: r.bemerkung as string | null,
    createdAt: r.created_at as string,
  }
}

export async function createFeedback(topic: string, description: string, isPrivate: boolean): Promise<FeedbackItem> {
  const res = await request<{ item: Record<string, unknown> }>('/api/feedback', {
    method: 'POST',
    body: { topic, description, isPrivate },
    skipTenant: true,
  })
  return feedbackFromRow(res.item)
}

export async function getFeedback(): Promise<FeedbackItem[]> {
  const res = await request<{ items: Record<string, unknown>[] }>('/api/feedback', { skipTenant: true })
  return res.items.map(feedbackFromRow)
}

export async function updateFeedbackStatus(id: number, status: 'open' | 'in_progress' | 'done'): Promise<FeedbackItem> {
  const res = await request<{ item: Record<string, unknown> }>(`/api/feedback/${id}/status`, {
    method: 'PUT',
    body: { status },
    skipTenant: true,
  })
  return feedbackFromRow(res.item)
}

export async function updateFeedbackNote(id: number, bemerkung: string | null): Promise<FeedbackItem> {
  const res = await request<{ item: Record<string, unknown> }>(`/api/feedback/${id}/note`, {
    method: 'PUT',
    body: { bemerkung },
    skipTenant: true,
  })
  return feedbackFromRow(res.item)
}

export async function deleteFeedback(id: number): Promise<void> {
  await request(`/api/feedback/${id}`, { method: 'DELETE', skipTenant: true })
}


// ============================================
// Gästelisten API
// ============================================

export type PassMap = Record<string, number>
export type GuestListStatus = 'open' | 'locked'
export type GuestEntryStatus = 'pending' | 'approved' | 'rejected'

export interface GuestListSettings {
  require_email?: boolean
  total_limit?: number | null
  per_entry_limit?: number | null
  per_inviter_limit?: number | null
  pass_types?: string[]           // aktive Pass-Typen (Default + ausgewählte Custom)
  custom_pass_types?: string[]    // alle je angelegten Custom-Typen (auch inaktive)
  artist_can_add?: boolean
  crew_plus_can_add?: boolean
  export_show_inviter?: boolean
  export_show_email?: boolean
}

export interface GuestList {
  id: number
  tenant_id: number
  termin_id: number
  name: string
  status: GuestListStatus
  settings: GuestListSettings
  sort_order: number
  entry_count?: number
  created_at: string
  updated_at: string
}

export interface GuestListEntry {
  id: number
  guest_list_id: number
  tenant_id: number
  first_name: string
  last_name: string
  company: string | null
  invited_by_text: string | null
  invited_by_user_id: number | null
  inviter_first_name?: string | null
  inviter_last_name?: string | null
  email: string | null
  passes: PassMap
  is_wish: number
  status: GuestEntryStatus
  notes: string | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

export async function getGuestLists(terminId: number): Promise<GuestList[]> {
  const res = await request<{ lists: GuestList[] }>(`/api/termine/${terminId}/guest-lists`)
  return res.lists
}

export async function createGuestList(terminId: number, name: string): Promise<GuestList> {
  const res = await request<{ list: GuestList }>(`/api/termine/${terminId}/guest-lists`, {
    method: 'POST', body: { name }
  })
  return res.list
}

export async function updateGuestList(id: number, data: Partial<{ name: string; settings: GuestListSettings; status: GuestListStatus }>): Promise<GuestList> {
  const res = await request<{ list: GuestList }>(`/api/guest-lists/${id}`, { method: 'PATCH', body: data })
  return res.list
}

export async function deleteGuestList(id: number): Promise<void> {
  await request(`/api/guest-lists/${id}`, { method: 'DELETE' })
}

export async function getGuestListEntries(listId: number): Promise<{ list: GuestList; entries: GuestListEntry[] }> {
  return request<{ list: GuestList; entries: GuestListEntry[] }>(`/api/guest-lists/${listId}/entries`)
}

export async function createGuestListEntry(listId: number, data: Partial<GuestListEntry>): Promise<GuestListEntry> {
  const res = await request<{ entry: GuestListEntry }>(`/api/guest-lists/${listId}/entries`, { method: 'POST', body: data })
  return res.entry
}

export async function updateGuestListEntry(id: number, data: Partial<GuestListEntry & { status: GuestEntryStatus }>): Promise<GuestListEntry> {
  const res = await request<{ entry: GuestListEntry }>(`/api/guest-list-entries/${id}`, { method: 'PATCH', body: data })
  return res.entry
}

export async function deleteGuestListEntry(id: number): Promise<void> {
  await request(`/api/guest-list-entries/${id}`, { method: 'DELETE' })
}

export function getGuestListCsvUrl(listId: number, token: string): string {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  return `${API_BASE}/api/guest-lists/${listId}/export/csv`
}

export function getGuestListPdfUrl(listId: number): string {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  return `${API_BASE}/api/guest-lists/${listId}/export/pdf`
}

// ============================================
// SUPERADMIN
// ============================================

export interface SuperadminUser {
  id: number
  email: string
  firstName: string
  lastName: string
  isSuperadmin: boolean
  createdAt: string
  tenantCount: number
  tenantNames: string
}

export async function superadminGetUsers(): Promise<SuperadminUser[]> {
  const res = await request<{ users: SuperadminUser[] }>('/api/superadmin/users', { skipTenant: true })
  return res.users
}

export async function superadminSetPassword(userId: number, password: string): Promise<void> {
  await request(`/api/superadmin/users/${userId}/password`, {
    method: 'PUT',
    body: { password },
    skipTenant: true,
  })
}

export async function superadminDeleteUser(userId: number): Promise<void> {
  await request(`/api/superadmin/users/${userId}`, { method: 'DELETE', skipTenant: true })
}

// ============================================
// ICAL FEED
// ============================================

export async function getIcalToken(): Promise<string> {
  const res = await request<{ token: string }>('/api/me/ical-token', { skipTenant: true })
  return res.token
}

export async function regenerateIcalToken(): Promise<string> {
  const res = await request<{ token: string }>('/api/me/ical-token/regenerate', {
    method: 'POST',
    skipTenant: true,
  })
  return res.token
}

export function getIcalUrl(token: string): string {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || (
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3002`
      : 'http://localhost:3002'
  )
  return `${API_BASE}/api/ical/${token}`
}
