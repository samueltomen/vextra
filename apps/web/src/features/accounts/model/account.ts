export type MembershipRole = 'member' | 'owner' | 'viewer'

export type CurrentAccount = Readonly<{
  role: MembershipRole
  tenantId: string
  user: Readonly<{
    email: string
    id: string
  }>
}>
