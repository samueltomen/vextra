import type {
  AvailabilityDay,
  AvailabilityDayState,
} from '../model/availability.ts'
import { formatDuration } from '../model/availability.ts'

const STATE_CLASS: Record<AvailabilityDayState, string> = {
  degraded: 'bg-warning-solid',
  down: 'bg-danger-solid',
  none: 'bg-line',
  up: 'bg-healthy-solid',
}

function describeDay(day: AvailabilityDay): string {
  const date = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(day.startMs)

  switch (day.state) {
    case 'none':
      return `${date} : pas encore surveillé`
    case 'up':
      return `${date} : aucun incident`
    default:
      return `${date} : ${formatDuration(day.downMs)} d’indisponibilité`
  }
}

export function AvailabilityBar({
  days,
}: Readonly<{ days: readonly AvailabilityDay[] }>) {
  const incidentDays = days.filter(
    (day) => day.state === 'degraded' || day.state === 'down',
  ).length

  return (
    <div>
      <div
        aria-label={`Disponibilité sur ${days.length} jours : ${incidentDays} jour${
          incidentDays > 1 ? 's' : ''
        } avec incident`}
        className="flex h-10 gap-[3px]"
        role="img"
      >
        {days.map((day) => (
          <span
            className={`min-w-0 flex-1 rounded-[3px] transition-opacity hover:opacity-70 ${STATE_CLASS[day.state]}`}
            key={day.startMs}
            title={describeDay(day)}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>Il y a {days.length} jours</span>
        <span>Aujourd’hui</span>
      </div>
    </div>
  )
}
