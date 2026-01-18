import { redirect } from 'next/navigation'

export default async function CompareRedirect({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
  redirect(`/league/${leagueId}/player-analysis?tab=compare`)
}
