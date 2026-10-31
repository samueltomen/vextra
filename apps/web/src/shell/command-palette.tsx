import { Modal, ModalContent } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Bell,
  CornerDownLeft,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from 'lucide-react'
import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'

import { listMonitors } from '../features/monitoring/api/monitoring-api.ts'
import { statusLabel } from '../features/monitoring/model/monitor-format.ts'
import { setThemePreference } from './theme.ts'

type PaletteItem = Readonly<{
  group: 'Actions' | 'Moniteurs' | 'Pages'
  hint?: string
  icon: ReactNode
  id: string
  label: string
  run: () => void
}>

const GROUP_ORDER = ['Pages', 'Actions', 'Moniteurs'] as const

function PaletteBody({
  onClose,
  onLogout,
}: Readonly<{ onClose: () => void; onLogout: () => void }>) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const navigate = useNavigate()
  const monitorsQuery = useQuery({
    queryFn: listMonitors,
    queryKey: ['monitors', null],
  })

  const items = useMemo<readonly PaletteItem[]>(() => {
    const iconProps = { 'aria-hidden': true, size: 17 } as const

    return [
      {
        group: 'Pages',
        icon: <LayoutDashboard {...iconProps} />,
        id: 'page-monitors',
        label: 'Tous les moniteurs',
        run: () => void navigate({ to: '/' }),
      },
      {
        group: 'Pages',
        icon: <Plus {...iconProps} />,
        id: 'page-new',
        label: 'Nouveau moniteur',
        run: () => void navigate({ to: '/monitors/new' }),
      },
      {
        group: 'Pages',
        icon: <Bell {...iconProps} />,
        id: 'page-notifications',
        label: 'Notifications',
        run: () => void navigate({ to: '/notifications' }),
      },
      {
        group: 'Pages',
        icon: <Settings {...iconProps} />,
        id: 'page-settings',
        label: 'Réglages du compte',
        run: () => void navigate({ to: '/settings' }),
      },
      {
        group: 'Actions',
        icon: <Sun {...iconProps} />,
        id: 'theme-light',
        label: 'Passer au thème clair',
        run: () => setThemePreference('light'),
      },
      {
        group: 'Actions',
        icon: <Moon {...iconProps} />,
        id: 'theme-dark',
        label: 'Passer au thème sombre',
        run: () => setThemePreference('dark'),
      },
      {
        group: 'Actions',
        icon: <Monitor {...iconProps} />,
        id: 'theme-system',
        label: 'Suivre le thème du système',
        run: () => setThemePreference('system'),
      },
      {
        group: 'Actions',
        icon: <LogOut {...iconProps} />,
        id: 'logout',
        label: 'Se déconnecter',
        run: onLogout,
      },
      ...(monitorsQuery.data ?? []).map((monitor): PaletteItem => ({
        group: 'Moniteurs',
        hint: statusLabel(monitor.status),
        icon: <LayoutDashboard {...iconProps} />,
        id: `monitor-${monitor.id}`,
        label: monitor.localLabel,
        run: () =>
          void navigate({
            params: { monitorId: monitor.id },
            to: '/monitors/$monitorId',
          }),
      })),
    ]
  }, [monitorsQuery.data, navigate, onLogout])

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = items
    .filter(
      (item) =>
        normalizedQuery.length === 0 ||
        item.label.toLowerCase().includes(normalizedQuery),
    )
    .sort(
      (left, right) =>
        GROUP_ORDER.indexOf(left.group) - GROUP_ORDER.indexOf(right.group),
    )

  function runItem(item: PaletteItem | undefined) {
    if (!item) {
      return
    }

    onClose()
    item.run()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(filtered.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      runItem(filtered[activeIndex])
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search aria-hidden="true" className="text-muted" size={18} />
        <input
          aria-activedescendant={
            filtered[activeIndex] ? `palette-${filtered[activeIndex].id}` : ''
          }
          aria-controls="palette-results"
          aria-label="Rechercher une page, une action ou un moniteur"
          autoFocus
          className="min-h-14 w-full bg-transparent text-base text-ink outline-none placeholder:text-muted"
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Aller à… ou rechercher un moniteur"
          role="combobox"
          value={query}
        />
        <kbd className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
          Échap
        </kbd>
      </div>

      <div
        className="max-h-[50vh] overflow-y-auto p-2"
        id="palette-results"
        role="listbox"
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted">
            Aucun résultat pour « {query.trim()} ».
          </p>
        ) : (
          filtered.map((item, index) => (
            <div key={item.id}>
              {index === 0 || filtered[index - 1]?.group !== item.group ? (
                <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {item.group}
                </p>
              ) : null}
              <button
                aria-selected={index === activeIndex}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${
                  index === activeIndex
                    ? 'bg-action-soft text-action'
                    : 'text-ink hover:bg-canvas'
                }`}
                id={`palette-${item.id}`}
                onClick={() => runItem(item)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                type="button"
              >
                {item.icon}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint ? (
                  <span className="text-xs text-muted">{item.hint}</span>
                ) : null}
                {index === activeIndex ? (
                  <CornerDownLeft aria-hidden="true" size={14} />
                ) : null}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function CommandPalette({
  isOpen,
  onLogout,
  onOpenChange,
}: Readonly<{
  isOpen: boolean
  onLogout: () => void
  onOpenChange: (isOpen: boolean) => void
}>) {
  return (
    <Modal
      aria-label="Palette de commandes"
      backdrop="blur"
      classNames={{ base: 'mt-[10vh] border border-line bg-surface' }}
      hideCloseButton
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="top"
      radius="lg"
      size="xl"
    >
      <ModalContent>
        {(onClose) => <PaletteBody onClose={onClose} onLogout={onLogout} />}
      </ModalContent>
    </Modal>
  )
}
