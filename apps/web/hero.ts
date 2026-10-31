import { heroui } from '@heroui/react'

export default heroui({
  themes: {
    dark: {
      colors: {
        background: '#0b0c0f',
        content1: '#111318',
        content2: '#16181f',
        danger: {
          DEFAULT: '#f87171',
          foreground: '#2d1010',
        },
        divider: '#23262e',
        focus: '#5eead4',
        foreground: '#e6e8ec',
        primary: {
          DEFAULT: '#2dd4bf',
          foreground: '#04211e',
        },
        success: {
          DEFAULT: '#4ade80',
          foreground: '#0f2a1c',
        },
        warning: {
          DEFAULT: '#fbbf24',
          foreground: '#2d2208',
        },
      },
    },
    light: {
      colors: {
        background: '#f6f7f9',
        danger: {
          DEFAULT: '#a12822',
          foreground: '#ffffff',
        },
        divider: '#e3e6eb',
        focus: '#0f766e',
        foreground: '#14171f',
        primary: {
          DEFAULT: '#0f766e',
          foreground: '#ffffff',
        },
        success: {
          DEFAULT: '#0e6245',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: '#7a4600',
          foreground: '#ffffff',
        },
      },
    },
  },
})
