import { HeroUIProvider } from '@heroui/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HomePage } from './home-page.tsx'

describe('HomePage', () => {
  it('presents the privacy-first value proposition', () => {
    render(
      <HeroUIProvider>
        <HomePage />
      </HeroUIProvider>,
    )

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /sachez quand un cron cesse de donner signe de vie/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/aucun script/i)).toBeInTheDocument()
  })
})
