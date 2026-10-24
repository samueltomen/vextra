import { heroui } from '@heroui/react'

export default heroui({
  themes: {
    dark: {
      colors: {
        background: '#0b1211',
        content1: '#121b1a',
        content2: '#17221f',
        danger: {
          DEFAULT: '#f87171',
          foreground: '#2d1010',
        },
        divider: '#243431',
        focus: '#5eead4',
        foreground: '#e8f0ee',
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
        background: '#f4f7f6',
        danger: {
          DEFAULT: '#a12822',
          foreground: '#ffffff',
        },
        divider: '#d8e1de',
        focus: '#0f766e',
        foreground: '#10201e',
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
