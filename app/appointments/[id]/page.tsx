import { redirect } from 'next/navigation'

export default function AppointmentRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/appointments/${params.id}/details`)
}
