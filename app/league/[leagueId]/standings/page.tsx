import { redirect } from 'next/navigation'

export default async function StandingsRedirect({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
  redirect(`/league/${leagueId}/teams`)
}
