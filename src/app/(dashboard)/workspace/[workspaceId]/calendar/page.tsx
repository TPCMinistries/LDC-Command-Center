import { CalendarView } from '@/components/calendar/CalendarView'

interface CalendarPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function CalendarPage({ params }: CalendarPageProps) {
  const { workspaceId } = await params

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Calendar</h1>
        <p className="text-zinc-400 mt-1">
          View all your deadlines, tasks, and events in one place
        </p>
      </div>

      <CalendarView workspaceId={workspaceId} />
    </div>
  )
}
