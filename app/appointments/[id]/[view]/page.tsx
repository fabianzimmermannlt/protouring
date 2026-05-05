import { redirect } from 'next/navigation'

export default function AppointmentDetailRedirect({ params }: { params: { id: string; view: string } }) {
  redirect(`/events/${params.id}/${params.view || 'details2'}`)
}
