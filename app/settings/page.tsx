'use client'

import { useState, useEffect } from 'react'
import { Save, X, Settings, User, Bell, Shield, Database, Globe, Palette, HelpCircle } from 'lucide-react'

interface AppSettings {
  general: {
    appName: string
    language: string
    timezone: string
    dateFormat: string
    currency: string
  }
  notifications: {
    emailNotifications: boolean
    pushNotifications: boolean
    reminderTime: string
    weeklyReport: boolean
  }
  security: {
    sessionTimeout: string
    twoFactorAuth: boolean
    passwordMinLength: string
    requirePasswordChange: boolean
  }
  data: {
    autoBackup: boolean
    backupFrequency: string
    dataRetention: string
    exportFormat: string
  }
  appearance: {
    theme: string
    fontSize: string
    primaryColor: string
    sidebarCollapsed: boolean
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    general: {
      appName: 'ProTouring',
      language: 'Deutsch',
      timezone: 'Europe/Berlin',
      dateFormat: 'DD.MM.YYYY',
      currency: 'EUR'
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: false,
      reminderTime: '15min',
      weeklyReport: true
    },
    security: {
      sessionTimeout: '8h',
      twoFactorAuth: false,
      passwordMinLength: '8',
      requirePasswordChange: false
    },
    data: {
      autoBackup: true,
      backupFrequency: 'daily',
      dataRetention: '12months',
      exportFormat: 'json'
    },
    appearance: {
      theme: 'light',
      fontSize: 'medium',
      primaryColor: '#3B82F6',
      sidebarCollapsed: false
    }
  })

  const [activeTab, setActiveTab] = useState('general')
  const [hasChanges, setHasChanges] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('protouring_settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      setSettings(parsed)
    }
  }, [])

  // Save settings to localStorage
  const saveSettings = () => {
    localStorage.setItem('protouring_settings', JSON.stringify(settings))
    setHasChanges(false)
    alert('Einstellungen wurden gespeichert!')
  }

  // Update setting
  const updateSetting = (category: keyof AppSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }))
    setHasChanges(true)
  }

  const tabs = [
    { id: 'general', name: 'Allgemein', icon: Globe },
    { id: 'notifications', name: 'Benachrichtigungen', icon: Bell },
    { id: 'security', name: 'Sicherheit', icon: Shield },
    { id: 'data', name: 'Daten', icon: Database },
    { id: 'appearance', name: 'Erscheinungsbild', icon: Palette }
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">EINSTELLUNGEN</h1>
        <div className="flex gap-3">
          <button
            onClick={() => {
              // Reset to defaults
              const defaultSettings: AppSettings = {
                general: {
                  appName: 'ProTouring',
                  language: 'Deutsch',
                  timezone: 'Europe/Berlin',
                  dateFormat: 'DD.MM.YYYY',
                  currency: 'EUR'
                },
                notifications: {
                  emailNotifications: true,
                  pushNotifications: false,
                  reminderTime: '15min',
                  weeklyReport: true
                },
                security: {
                  sessionTimeout: '8h',
                  twoFactorAuth: false,
                  passwordMinLength: '8',
                  requirePasswordChange: false
                },
                data: {
                  autoBackup: true,
                  backupFrequency: 'daily',
                  dataRetention: '12months',
                  exportFormat: 'json'
                },
                appearance: {
                  theme: 'light',
                  fontSize: 'medium',
                  primaryColor: '#3B82F6',
                  sidebarCollapsed: false
                }
              }
              setSettings(defaultSettings)
              setHasChanges(true)
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            Zurücksetzen
          </button>
          <button
            onClick={saveSettings}
            disabled={!hasChanges}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
              hasChanges 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Save className="h-4 w-4" />
            Speichern
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 bg-white rounded-lg border p-4">
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-lg border p-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <Globe className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Allgemeine Einstellungen</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Anwendungsname
                    </label>
                    <input
                      type="text"
                      value={settings.general.appName}
                      onChange={(e) => updateSetting('general', 'appName', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sprache
                    </label>
                    <select
                      value={settings.general.language}
                      onChange={(e) => updateSetting('general', 'language', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Deutsch">Deutsch</option>
                      <option value="English">English</option>
                      <option value="Français">Français</option>
                      <option value="Español">Español</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Zeitzone
                    </label>
                    <select
                      value={settings.general.timezone}
                      onChange={(e) => updateSetting('general', 'timezone', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Europe/Berlin">Europe/Berlin</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Datumsformat
                    </label>
                    <select
                      value={settings.general.dateFormat}
                      onChange={(e) => updateSetting('general', 'dateFormat', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Währung
                    </label>
                    <select
                      value={settings.general.currency}
                      onChange={(e) => updateSetting('general', 'currency', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CHF">CHF (Fr)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <Bell className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Benachrichtigungseinstellungen</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">E-Mail-Benachrichtigungen</label>
                    <p className="text-xs text-gray-500">Erhalte wichtige Updates per E-Mail</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.emailNotifications}
                    onChange={(e) => updateSetting('notifications', 'emailNotifications', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Push-Benachrichtigungen</label>
                    <p className="text-xs text-gray-500">Erhalte Benachrichtigungen im Browser</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.pushNotifications}
                    onChange={(e) => updateSetting('notifications', 'pushNotifications', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Standard-Erinnerungszeit
                  </label>
                  <select
                    value={settings.notifications.reminderTime}
                    onChange={(e) => updateSetting('notifications', 'reminderTime', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="5min">5 Minuten vorher</option>
                    <option value="15min">15 Minuten vorher</option>
                    <option value="30min">30 Minuten vorher</option>
                    <option value="1hour">1 Stunde vorher</option>
                    <option value="1day">1 Tag vorher</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Wöchentlicher Bericht</label>
                    <p className="text-xs text-gray-500">Erhalte wöchentliche Zusammenfassungen</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.weeklyReport}
                    onChange={(e) => updateSetting('notifications', 'weeklyReport', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <Shield className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Sicherheitseinstellungen</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session-Timeout
                  </label>
                  <select
                    value={settings.security.sessionTimeout}
                    onChange={(e) => updateSetting('security', 'sessionTimeout', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="1h">1 Stunde</option>
                    <option value="4h">4 Stunden</option>
                    <option value="8h">8 Stunden</option>
                    <option value="24h">24 Stunden</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Zwei-Faktor-Authentifizierung</label>
                    <p className="text-xs text-gray-500">Zusätzliche Sicherheitsebene für den Login</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.security.twoFactorAuth}
                    onChange={(e) => updateSetting('security', 'twoFactorAuth', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mindestlänge des Passworts
                  </label>
                  <select
                    value={settings.security.passwordMinLength}
                    onChange={(e) => updateSetting('security', 'passwordMinLength', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="6">6 Zeichen</option>
                    <option value="8">8 Zeichen</option>
                    <option value="12">12 Zeichen</option>
                    <option value="16">16 Zeichen</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Regelmäßige Passwortänderung</label>
                    <p className="text-xs text-gray-500">Erzwingt Passwortänderung in bestimmten Intervallen</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.security.requirePasswordChange}
                    onChange={(e) => updateSetting('security', 'requirePasswordChange', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Data Settings */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <Database className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Daten-Einstellungen</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Automatische Sicherung</label>
                    <p className="text-xs text-gray-500">Regelmäßige Sicherung der Daten</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.data.autoBackup}
                    onChange={(e) => updateSetting('data', 'autoBackup', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sicherungsfrequenz
                  </label>
                  <select
                    value={settings.data.backupFrequency}
                    onChange={(e) => updateSetting('data', 'backupFrequency', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="daily">Täglich</option>
                    <option value="weekly">Wöchentlich</option>
                    <option value="monthly">Monatlich</option>
                    <option value="manual">Manuell</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Datenaufbewahrung
                  </label>
                  <select
                    value={settings.data.dataRetention}
                    onChange={(e) => updateSetting('data', 'dataRetention', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="1month">1 Monat</option>
                    <option value="3months">3 Monate</option>
                    <option value="6months">6 Monate</option>
                    <option value="12months">12 Monate</option>
                    <option value="unlimited">Unbegrenzt</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Export-Format
                  </label>
                  <select
                    value={settings.data.exportFormat}
                    onChange={(e) => updateSetting('data', 'exportFormat', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                    <option value="xlsx">Excel</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <Palette className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Erscheinungsbild</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Theme
                  </label>
                  <select
                    value={settings.appearance.theme}
                    onChange={(e) => updateSetting('appearance', 'theme', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="light">Hell</option>
                    <option value="dark">Dunkel</option>
                    <option value="auto">Automatisch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Schriftgröße
                  </label>
                  <select
                    value={settings.appearance.fontSize}
                    onChange={(e) => updateSetting('appearance', 'fontSize', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="small">Klein</option>
                    <option value="medium">Mittel</option>
                    <option value="large">Groß</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primärfarbe
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.appearance.primaryColor}
                      onChange={(e) => updateSetting('appearance', 'primaryColor', e.target.value)}
                      className="w-16 h-8 border border-gray-300 rounded"
                    />
                    <input
                      type="text"
                      value={settings.appearance.primaryColor}
                      onChange={(e) => updateSetting('appearance', 'primaryColor', e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Sidebar standardmäßig eingeklappt</label>
                    <p className="text-xs text-gray-500">Sidebar beim Start eingeklappt anzeigen</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appearance.sidebarCollapsed}
                    onChange={(e) => updateSetting('appearance', 'sidebarCollapsed', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
