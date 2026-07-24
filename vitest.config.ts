import { defineConfig } from 'vitest/config'

// Unit-Tests für den Kalkulations-Rechenkern (lib/calculation).
// Bewusst eng gescoped, damit der Next.js-Teil nicht mitgezogen wird.
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
})
