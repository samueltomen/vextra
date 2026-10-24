export type CurrentAccount = Readonly<{
  tenantId: string
  user: Readonly<{
    email: string
    id: string
  }>
}>
