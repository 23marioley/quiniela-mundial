'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import NavMenu, { UserChip } from '../components/NavMenu'

type Profile = { id: string; display_name: string }
type Entry = { id: number; name: string; user_id: string; display_name: string }
type Team = { id: number; name: string; flag: string }
type MatchPred = {
    id: number
    match_number: number
    match_date: string
    city: string
    group_name: string
    home_team: Team
    away_team: Team
    home_score: number
    away_score: number
    predicted_home: number | null
    predicted_away: number | null
    points_earned: number | null
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function formatDate(utcString: string) {
    const d = new Date(utcString)
    const mty = new Date(d.getTime() - 6 * 60 * 60 * 1000)
    const day = DAYS[mty.getUTCDay()]
    const date = mty.getUTCDate()
    const month = MONTHS[mty.getUTCMonth()]
    const hours = mty.getUTCHours()
    const minutes = mty.getUTCMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'pm' : 'am'
    const h = hours % 12 || 12
    return { dayStr: `${day} ${date} ${month}`, timeStr: `${h}:${minutes} ${ampm}` }
}

export default function GrupoPage() {
    const router = useRouter()
    const supabase = createClient()
    const [entries, setEntries] = useState<Entry[]>([])
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
    const [matches, setMatches] = useState<MatchPred[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMatches, setLoadingMatches] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    useEffect(() => { loadEntries() }, [])

    async function loadEntries() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }
        setCurrentUserId(user.id)

        // Primero cargamos las quinielas
        const { data: entriesData } = await supabase
            .from('entries')
            .select('id, name, user_id')
            .order('user_id')
            .order('id')

        if (!entriesData) { setLoading(false); return }

        // Luego los perfiles de los usuarios únicos
        const userIds = [...new Set(entriesData.map((e: any) => e.user_id))]
        const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds)

        const profilesMap: Record<string, string> = {}
        profilesData?.forEach((p: any) => { profilesMap[p.id] = p.display_name })

        const formatted = entriesData.map((e: any) => ({
            id: e.id,
            name: e.name,
            user_id: e.user_id,
            display_name: profilesMap[e.user_id] ?? 'Usuario'
        }))

        setEntries(formatted)
        setLoading(false)
    }

    async function loadMatchesForEntry(entry: Entry) {
        setSelectedEntry(entry)
        setLoadingMatches(true)
        setMatches([])

        // Cargar partidos terminados con pronósticos de esta quiniela
        const { data: matchesData } = await supabase
            .from('matches')
            .select(`
        id, match_number, match_date, city, status,
        home_score, away_score,
        groups!inner(name),
        home_team:teams!matches_home_team_id_fkey(id, name, flag),
        away_team:teams!matches_away_team_id_fkey(id, name, flag)
      `)
            .eq('status', 'finished')
            .order('match_date', { ascending: true })

        if (!matchesData) { setLoadingMatches(false); return }

        // Cargar pronósticos de esta quiniela
        const { data: predsData } = await supabase
            .from('predictions')
            .select('match_id, predicted_home, predicted_away, points_earned')
            .eq('entry_id', entry.id)

        const predsMap: Record<number, any> = {}
        predsData?.forEach((p: any) => { predsMap[p.match_id] = p })

        const formatted = matchesData.map((m: any) => ({
            id: m.id,
            match_number: m.match_number,
            match_date: m.match_date,
            city: m.city,
            group_name: m.groups?.name ?? '',
            home_team: m.home_team,
            away_team: m.away_team,
            home_score: m.home_score,
            away_score: m.away_score,
            predicted_home: predsMap[m.id]?.predicted_home ?? null,
            predicted_away: predsMap[m.id]?.predicted_away ?? null,
            points_earned: predsMap[m.id]?.points_earned ?? null,
        }))

        setMatches(formatted)
        setLoadingMatches(false)
    }

    const totalPoints = matches.reduce((sum, m) => sum + (m.points_earned ?? 0), 0)
    const exactScores = matches.filter(m => m.points_earned === 3).length
    const correctResults = matches.filter(m => m.points_earned === 1).length

    // Agrupar por fecha
    const matchesByDate: Record<string, MatchPred[]> = {}
    matches.forEach(m => {
        const { dayStr } = formatDate(m.match_date)
        if (!matchesByDate[dayStr]) matchesByDate[dayStr] = []
        matchesByDate[dayStr].push(m)
    })

    if (loading) return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
            <p className="text-gray-400">Cargando...</p>
        </main>
    )

    return (
        <main className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                <NavMenu />
                <div>
                    <p className="font-bold text-gray-900">Pronósticos del grupo</p>
                    <p className="text-xs text-gray-400">Partidos terminados</p>
                </div>
                </div>
                <UserChip />
            </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 py-6">

                {/* Selector de quiniela */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
                    <label className="text-sm font-medium text-gray-700 block mb-3">
                        Selecciona una quiniela para ver sus pronósticos
                    </label>
                    <select
                        onChange={e => {
                            const entry = entries.find(en => en.id === parseInt(e.target.value))
                            if (entry) loadMatchesForEntry(entry)
                        }}
                        defaultValue=""
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-green-600 bg-white"
                    >
                        <option value="" disabled>Elige un participante...</option>
                        {entries.map(entry => {
                            const userEntries = entries.filter(e => e.user_id === entry.user_id)
                            const label = userEntries.length > 1
                                ? `${entry.display_name} — ${entry.name}`
                                : entry.display_name
                            return (
                                <option key={entry.id} value={entry.id}>
                                    {label}{entry.user_id === currentUserId ? ' (tú)' : ''}
                                </option>
                            )
                        })}
                    </select>
                </div>

                {/* Stats del seleccionado */}
                {selectedEntry && !loadingMatches && matches.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                            <p className="text-2xl font-bold" style={{ color: '#006847' }}>{totalPoints}</p>
                            <p className="text-xs text-gray-400 mt-1">Puntos totales</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                            <p className="text-2xl font-bold text-green-500">{exactScores}</p>
                            <p className="text-xs text-gray-400 mt-1">Exactos 🎯</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                            <p className="text-2xl font-bold text-blue-500">{correctResults}</p>
                            <p className="text-xs text-gray-400 mt-1">Resultados ✓</p>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loadingMatches && (
                    <div className="text-center py-10">
                        <p className="text-gray-400">Cargando pronósticos...</p>
                    </div>
                )}

                {/* Sin partidos terminados */}
                {selectedEntry && !loadingMatches && matches.length === 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                        <p className="text-4xl mb-3">⏳</p>
                        <p className="font-semibold text-gray-900">Aún no hay partidos terminados</p>
                        <p className="text-gray-400 text-sm mt-1">Vuelve cuando haya resultados disponibles</p>
                    </div>
                )}

                {/* Sin selección */}
                {!selectedEntry && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                        <p className="text-4xl mb-3">👆</p>
                        <p className="font-semibold text-gray-900">Selecciona una quiniela</p>
                        <p className="text-gray-400 text-sm mt-1">Elige un participante del menú de arriba</p>
                    </div>
                )}

                {/* Lista de partidos */}
                {!loadingMatches && Object.entries(matchesByDate).map(([dateStr, dayMatches]) => (
                    <div key={dateStr} className="mb-6">
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <div className="h-px flex-1 bg-gray-200" />
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                📅 {dateStr}
                            </span>
                            <div className="h-px flex-1 bg-gray-200" />
                        </div>

                        <div className="flex flex-col gap-3">
                            {dayMatches.map(match => {
                                const { timeStr } = formatDate(match.match_date)
                                const pts = match.points_earned

                                return (
                                    <div key={match.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">

                                        {/* Info */}
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                                                style={{ backgroundColor: '#006847' }}>
                                                Grupo {match.group_name}
                                            </span>
                                            <span className="text-xs text-gray-400">{timeStr} · {match.city}</span>
                                        </div>

                                        {/* Equipos */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex-1 flex flex-col items-center gap-1">
                                                <span className="text-3xl">{match.home_team.flag}</span>
                                                <span className="text-xs text-center font-medium text-gray-700 leading-tight">
                                                    {match.home_team.name}
                                                </span>
                                            </div>

                                            <div className="flex flex-col items-center gap-2">
                                                {/* Resultado real */}
                                                <div className="flex items-center gap-1">
                                                    <span className="w-10 h-10 flex items-center justify-center text-lg font-bold bg-gray-100 rounded-xl text-gray-900">
                                                        {match.home_score}
                                                    </span>
                                                    <span className="text-gray-300 font-bold">—</span>
                                                    <span className="w-10 h-10 flex items-center justify-center text-lg font-bold bg-gray-100 rounded-xl text-gray-900">
                                                        {match.away_score}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-gray-400">resultado</span>

                                                {/* Pronóstico */}
                                                <div className="flex items-center gap-1">
                                                    <span className={`w-10 h-10 flex items-center justify-center text-lg font-bold rounded-xl ${pts === 3 ? 'bg-green-100 text-green-700' :
                                                            pts === 1 ? 'bg-blue-100 text-blue-700' :
                                                                pts === 0 ? 'bg-red-50 text-red-400' :
                                                                    'bg-gray-50 text-gray-400'
                                                        }`}>
                                                        {match.predicted_home ?? '?'}
                                                    </span>
                                                    <span className="text-gray-300 font-bold">—</span>
                                                    <span className={`w-10 h-10 flex items-center justify-center text-lg font-bold rounded-xl ${pts === 3 ? 'bg-green-100 text-green-700' :
                                                            pts === 1 ? 'bg-blue-100 text-blue-700' :
                                                                pts === 0 ? 'bg-red-50 text-red-400' :
                                                                    'bg-gray-50 text-gray-400'
                                                        }`}>
                                                        {match.predicted_away ?? '?'}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-gray-400">pronóstico</span>
                                            </div>

                                            <div className="flex-1 flex flex-col items-center gap-1">
                                                <span className="text-3xl">{match.away_team.flag}</span>
                                                <span className="text-xs text-center font-medium text-gray-700 leading-tight">
                                                    {match.away_team.name}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Badge de puntos */}
                                        <div className="mt-3 flex justify-center">
                                            {pts === 3 && (
                                                <span className="px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700">
                                                    +3 pts 🎯 Marcador exacto
                                                </span>
                                            )}
                                            {pts === 1 && (
                                                <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                                                    +1 pt ✓ Resultado correcto
                                                </span>
                                            )}
                                            {pts === 0 && (
                                                <span className="px-3 py-1 rounded-full text-sm font-bold bg-red-50 text-red-400">
                                                    +0 pts ✗ Sin acierto
                                                </span>
                                            )}
                                            {pts === null && (
                                                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-400">
                                                    Sin pronóstico
                                                </span>
                                            )}
                                        </div>

                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </main>
    )
}