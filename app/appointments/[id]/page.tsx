import { redirect } from 'next/navigation'

export default function AppointmentRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/events/${params.id}/details2`)
}
