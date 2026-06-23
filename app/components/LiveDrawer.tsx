'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type LiveMatch = {
    id: number
    match_number: number
    match_date: string
    group_name: string
    home_team: { name: string; flag: string }
    away_team: { name: string; flag: string }
}

type MatchPrediction = {
    display_name: string
    avatar_url: string | null
    predicted_home: number | null
    predicted_away: number | null
}

export default function LiveDrawer() {
    const supabase = createClient()
    const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([])
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null)
    const [predictions, setPredictions] = useState<MatchPrediction[]>([])
    const [loadingPreds, setLoadingPreds] = useState(false)

    useEffect(() => {
        checkLive()
        const interval = setInterval(checkLive, 60_000)
        return () => clearInterval(interval)
    }, [])

    async function checkLive() {
        const now = new Date()
        const windowStart = new Date(now.getTime() - 2.5 * 60 * 60 * 1000).toISOString()
        const { data } = await supabase
            .from('matches')
            .select(`
                id, match_number, match_date,
                groups!inner(name),
                home_team:teams!matches_home_team_id_fkey(name, flag),
                away_team:teams!matches_away_team_id_fkey(name, flag)
            `)
            .eq('status', 'upcoming')
            .gte('match_date', windowStart)
            .lte('match_date', now.toISOString())
            .order('match_date', { ascending: true })

        setLiveMatches((data ?? []).map((m: any) => ({ ...m, group_name: m.groups?.name ?? '' })))
    }

    async function loadPredictions(match: LiveMatch) {
        setSelectedMatch(match)
        setLoadingPreds(true)
        setPredictions([])

        const { data: entries } = await supabase.from('entries').select('id, user_id')
        const entryIds = (entries ?? []).map((e: any) => e.id)
        const userIds = [...new Set((entries ?? []).map((e: any) => e.user_id as string))]

        const [{ data: preds }, { data: profiles }] = await Promise.all([
            supabase.from('predictions').select('entry_id, predicted_home, predicted_away').eq('match_id', match.id).in('entry_id', entryIds),
            supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds)
        ])

        const profileMap: Record<string, any> = {}
        profiles?.forEach((p: any) => { profileMap[p.id] = p })

        const predsMap: Record<number, any> = {}
        preds?.forEach((p: any) => { predsMap[p.entry_id] = p })

        const result: MatchPrediction[] = (entries ?? []).map((e: any) => ({
            display_name: profileMap[e.user_id]?.display_name ?? 'Usuario',
            avatar_url: profileMap[e.user_id]?.avatar_url ?? null,
            predicted_home: predsMap[e.id]?.predicted_home ?? null,
            predicted_away: predsMap[e.id]?.predicted_away ?? null,
        })).sort((a, b) => a.display_name.localeCompare(b.display_name))

        setPredictions(result)
        setLoadingPreds(false)
    }

    useEffect(() => {
        document.body.style.overflow = modalOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [modalOpen])

    function closeModal() {
        setModalOpen(false)
        setSelectedMatch(null)
        setPredictions([])
    }

    if (liveMatches.length === 0) return null

    return (
        <>
            {/* Botón flotante */}
            <button
                onClick={() => setModalOpen(true)}
                className="fixed bottom-6 right-4 z-30 flex items-center gap-2 px-4 py-3 rounded-2xl text-white text-sm font-bold shadow-xl" style={{ bottom: '1.5rem', right: '1rem', left: 'auto', top: 'auto',background: 'linear-gradient(135deg, #dc2626, #991b1b)' }}
            >
                {/* <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                </span> */}
                ⚽ EN VIVO {liveMatches.length > 1 ? `· ${liveMatches.length}` : ''}
            </button>

            {/* Overlay */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/75 z-40 flex items-center justify-center px-4 backdrop-blur-sm"
                    onClick={closeModal}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden" style={{ maxHeight: '80vh' }}
                        onClick={e => e.stopPropagation()}>

                        {!selectedMatch ? (
                            <>
                                {/* Header lista */}
                                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                                        </span>
                                        <p className="font-bold text-gray-900">En Vivo</p>
                                    </div>
                                    <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                                </div>

                                {/* Lista de partidos */}
                                <div className="p-4 flex flex-col gap-3 overflow-y-auto">
                                    {liveMatches.map(match => (
                                        <button key={match.id} onClick={() => loadPredictions(match)}
                                            className="w-full bg-gray-50 hover:bg-gray-100 transition-colors rounded-2xl p-4 text-left">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-semibold text-white px-2 py-0.5 rounded-full"
                                                    style={{ backgroundColor: '#006847' }}>
                                                    Grupo {match.group_name}
                                                </span>
                                                {/* <span className="text-xs text-red-500 font-semibold">#{match.match_number}</span> */}
                                            </div>
                                            <div className="flex items-center justify-center gap-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-3xl">{match.home_team.flag}</span>
                                                    <span className="text-xs font-medium text-gray-700">{match.home_team.name}</span>
                                                </div>
                                                <span className="text-gray-300 font-bold text-sm">vs</span>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-3xl">{match.away_team.flag}</span>
                                                    <span className="text-xs font-medium text-gray-700">{match.away_team.name}</span>
                                                </div>
                                            </div>
                                           <p className="text-xs text-center font-semibold mt-4" style={{ color: '#006847' }}>Ver pronósticos →</p>
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Header pronósticos */}
                                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                                    <button onClick={() => { setSelectedMatch(null); setPredictions([]) }}
                                        className="text-gray-400 hover:text-gray-600 text-sm font-medium">
                                        ← Volver
                                    </button>
                                    <div className="flex-1 text-center">
                                        <p className="font-bold text-gray-900 text-sm">
                                            {selectedMatch.home_team.flag} {selectedMatch.home_team.name} vs {selectedMatch.away_team.name} {selectedMatch.away_team.flag}
                                        </p>
                                    </div>
                                    <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                                </div>

                                {/* Lista pronósticos */}
                                <div className="p-4 flex flex-col gap-2 overscroll-contain" style={{ overflowY: 'scroll', flex: 1 }}>
                                    {loadingPreds ? (
                                        <p className="text-center text-gray-400 py-8">Cargando pronósticos...</p>
                                    ) : predictions.map((p, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                {p.avatar_url
                                                    ? <img src={p.avatar_url} className="w-full h-full object-cover" />
                                                    : <span className="text-sm">👤</span>}
                                            </div>
                                            <p className="flex-1 text-sm font-semibold text-gray-800">{p.display_name}</p>
                                            {p.predicted_home !== null
                                                ? <span className="font-bold text-gray-900 text-sm px-3 py-1 bg-white rounded-xl border border-gray-200">
                                                    {p.predicted_home} — {p.predicted_away}
                                                  </span>
                                                : <span className="text-xs text-gray-300">Sin pronóstico</span>
                                            }
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}