import { heroui } from '@heroui/react'

export default heroui({
  themes: {
    light: {
      colors: {
        background: '#f7f8f6',
        danger: {
          DEFAULT: '#a12822',
          foreground: '#ffffff',
        },
        focus: '#1f5eff',
        foreground: '#151a1d',
        primary: {
          DEFAULT: '#1f5eff',
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
