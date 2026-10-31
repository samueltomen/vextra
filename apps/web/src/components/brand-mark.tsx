import { Activity } from 'lucide-react'

const SIZES = {
  lg: { box: 'size-12 rounded-2xl', icon: 25 },
  md: { box: 'size-10 rounded-xl', icon: 21 },
  sm: { box: 'size-8 rounded-lg', icon: 17 },
} as const

export function BrandMark({
  size = 'md',
}: Readonly<{ size?: keyof typeof SIZES }>) {
  const config = SIZES[size]

  return (
    <span
      className={`grid shrink-0 place-items-center bg-linear-to-br from-[#5eead4] to-[#0f9488] text-[#032421] shadow-[0_6px_18px_-6px_rgb(45_212_191/65%)] ${config.box}`}
    >
      <Activity aria-hidden="true" size={config.icon} strokeWidth={2.4} />
    </span>
  )
}
