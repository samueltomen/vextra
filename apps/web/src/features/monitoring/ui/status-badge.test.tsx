import { HeroUIProvider } from '@heroui/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusBadge } from './status-badge.tsx'

describe('StatusBadge', () => {
  it.each([
    ['healthy', 'Opérationnel'],
    ['late', 'En retard'],
    ['paused', 'En pause'],
    ['pending', 'En attente'],
  ] as const)('renders a readable label for %s', (status, label) => {
    render(
      <HeroUIProvider>
        <StatusBadge status={status} />
      </HeroUIProvider>,
    )

    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByText(label)).toBeVisible()
  })
})
