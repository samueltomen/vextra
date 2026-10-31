import { useId, useState } from 'react'

export type ChartSeries = Readonly<{
  color: string
  name: string
  values: readonly (number | null)[]
}>

export type ChartReference = Readonly<{ label: string; value: number }>

const WIDTH = 640
const PAD = { bottom: 22, left: 40, right: 10, top: 10 } as const
const GRID_LINES = 4

function niceCeiling(value: number): number {
  if (value <= 0) {
    return 1
  }

  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10

  return step * magnitude
}

export function TimeSeriesChart({
  ariaLabel,
  formatValue,
  height = 170,
  integerTicks = false,
  labels,
  reference,
  series,
}: Readonly<{
  ariaLabel: string
  formatValue: (value: number) => string
  height?: number
  integerTicks?: boolean
  labels: readonly string[]
  reference?: ChartReference | undefined
  series: readonly ChartSeries[]
}>) {
  const gradientId = useId()
  const [hovered, setHovered] = useState<number | null>(null)
  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = height - PAD.top - PAD.bottom
  const values = series.flatMap((entry) =>
    entry.values.filter((value): value is number => value !== null),
  )
  const max = niceCeiling(Math.max(...values, reference?.value ?? 0, 0) * 1.05)
  const count = Math.max(labels.length, 2)
  const x = (index: number) => PAD.left + (index / (count - 1)) * plotWidth
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight

  function pathFor(entry: ChartSeries): string {
    let path = ''
    let drawing = false

    entry.values.forEach((value, index) => {
      if (value === null) {
        drawing = false

        return
      }

      path += `${drawing ? 'L' : 'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)} `
      drawing = true
    })

    return path.trim()
  }

  function areaFor(entry: ChartSeries): string {
    const points = entry.values
      .map((value, index) =>
        value === null ? null : ([index, value] as const),
      )
      .filter((point): point is readonly [number, number] => point !== null)

    if (points.length === 0) {
      return ''
    }

    const first = points[0]!
    const last = points.at(-1)!
    const line = points
      .map(([index, value]) => `L${x(index).toFixed(1)} ${y(value).toFixed(1)}`)
      .join(' ')

    return `M${x(first[0]).toFixed(1)} ${y(0).toFixed(1)} ${line} L${x(last[0]).toFixed(1)} ${y(0).toFixed(1)} Z`
  }

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left) / box.width
    const svgX = ratio * WIDTH
    const index = Math.round(((svgX - PAD.left) / plotWidth) * (count - 1))

    setHovered(Math.min(count - 1, Math.max(0, index)))
  }

  const ticks = Array.from({ length: GRID_LINES + 1 }, (_, index) => {
    const value = (max / GRID_LINES) * index

    return { value, y: y(value) }
  })
  const hoveredLabel = hovered === null ? null : labels[hovered]

  return (
    <div className="relative">
      <svg
        aria-label={ariaLabel}
        className="block h-auto w-full"
        onMouseLeave={() => setHovered(null)}
        onMouseMove={handleMove}
        role="img"
        viewBox={`0 0 ${WIDTH} ${height}`}
      >
        <defs>
          {series.map((entry, index) => (
            <linearGradient
              id={`${gradientId}-${index}`}
              key={entry.name}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0%" stopColor={entry.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={entry.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {ticks.map((tick) => (
          <g key={tick.value}>
            <line
              stroke="var(--cp-color-border-subtle)"
              strokeDasharray={tick.value === 0 ? undefined : '3 4'}
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={tick.y}
              y2={tick.y}
            />
            <text
              className="fill-muted"
              fontFamily="var(--cp-font-mono)"
              fontSize="10"
              textAnchor="end"
              x={PAD.left - 6}
              y={tick.y + 3}
            >
              {formatValue(tick.value)}
            </text>
          </g>
        ))}

        {[0, Math.floor((count - 1) / 2), count - 1].map((index) => (
          <text
            className="fill-muted"
            fontFamily="var(--cp-font-mono)"
            fontSize="10"
            key={index}
            textAnchor={
              index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'
            }
            x={x(index)}
            y={height - 6}
          >
            {labels[index] ?? ''}
          </text>
        ))}

        {reference ? (
          <g>
            <line
              stroke="var(--cp-color-warning-solid)"
              strokeDasharray="5 4"
              strokeWidth="1.25"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(reference.value)}
              y2={y(reference.value)}
            />
            <text
              fill="var(--cp-color-warning-solid)"
              fontFamily="var(--cp-font-mono)"
              fontSize="10"
              textAnchor="end"
              x={WIDTH - PAD.right}
              y={y(reference.value) - 4}
            >
              {reference.label}
            </text>
          </g>
        ) : null}

        {series.map((entry, index) => (
          <g key={entry.name}>
            <path d={areaFor(entry)} fill={`url(#${gradientId}-${index})`} />
            <path
              d={pathFor(entry)}
              fill="none"
              stroke={entry.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </g>
        ))}

        {hovered !== null ? (
          <g>
            <line
              stroke="var(--cp-color-border-strong)"
              x1={x(hovered)}
              x2={x(hovered)}
              y1={PAD.top}
              y2={PAD.top + plotHeight}
            />
            {series.map((entry) => {
              const value = entry.values[hovered]

              return value === null || value === undefined ? null : (
                <circle
                  cx={x(hovered)}
                  cy={y(value)}
                  fill="var(--cp-color-surface)"
                  key={entry.name}
                  r="4"
                  stroke={entry.color}
                  strokeWidth="2"
                />
              )
            })}
          </g>
        ) : null}
      </svg>

      {hovered !== null && hoveredLabel ? (
        <div
          className="pointer-events-none absolute top-1 rounded-md border border-line bg-raised px-2.5 py-1.5 font-mono text-[11px] shadow-raised"
          style={{
            left: `${(x(hovered) / WIDTH) * 100}%`,
            transform:
              hovered > count / 2 ? 'translateX(-105%)' : 'translateX(8px)',
          }}
        >
          <p className="text-muted">{hoveredLabel}</p>
          {series.map((entry) => {
            const value = entry.values[hovered]

            return (
              <p key={entry.name} style={{ color: entry.color }}>
                {entry.name} :{' '}
                {value === null || value === undefined
                  ? '—'
                  : formatValue(value)}
              </p>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
