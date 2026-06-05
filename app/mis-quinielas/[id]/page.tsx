'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import Link from 'next/link'
import NavMenu from '../../components/NavMenu'

type Team = { id: number; name: string; flag: string }
type Match = {
  id: number
  match_number: number
  match_date: string
  venue: string
  city: string
  country: string
  group_id: number
  group_name: string
  home_team: Team
  away_team: Team
  status: string
  home_score: number | null
  away_score: number | null
}
type Prediction = {
  match_id: number
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

function isLocked(matchDate: string) {
  const match = new Date(matchDate)
  const now = new Date()
  return now >= new Date(match.getTime() - 15 * 60 * 1000)
}

export default function QuinielaPage() {
  const router = useRouter()
  const params = useParams()
  const entryId = Number(params.id)
  const supabase = createClient()

  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Record<number, Prediction>>({})
  const [entryName, setEntryName] = useState('')
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Verificar que la quiniela pertenece al usuario
    const { data: entry } = await supabase
      .from('entries')
      .select('id, name, user_id')
      .eq('id', entryId)
      .single()

    if (!entry || entry.user_id !== user.id) { router.push('/mis-quinielas'); return }
    setEntryName(entry.name)

    // Cargar partidos con equipos y grupos
    const { data: matchesData } = await supabase
      .from('matches')
      .select(`
        id, match_number, match_date, venue, city, country, status,
        home_score, away_score, group_id,
        groups!inner(name),
        home_team:teams!matches_home_team_id_fkey(id, name, flag),
        away_team:teams!matches_away_team_id_fkey(id, name, flag)
    `)
      .order('match_date', { ascending: true })

    if (matchesData) {
      //   console.log('Primer partido:', JSON.stringify(matchesData[0], null, 2))

      const formatted = matchesData.map((m: any) => ({
        ...m,
        group_name: Array.isArray(m.groups) ? m.groups[0]?.name : m.groups?.name ?? '',
        home_team: Array.isArray(m.home_team) ? m.home_team[0] : m.home_team,
        away_team: Array.isArray(m.away_team) ? m.away_team[0] : m.away_team,
      }))
      setMatches(formatted)
    }

    // Cargar pronósticos existentes
    const { data: predsData } = await supabase
      .from('predictions')
      .select('match_id, predicted_home, predicted_away, points_earned')
      .eq('entry_id', entryId)

    if (predsData) {
      const map: Record<number, Prediction> = {}
      predsData.forEach((p: any) => { map[p.match_id] = p })
      setPredictions(map)
    }

    setLoading(false)
  }

  const savePrediction = useCallback(async (matchId: number, home: number | null, away: number | null) => {
    if (home === null || away === null) return
    setSaving(s => ({ ...s, [matchId]: true }))

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('predictions')
      .upsert({
        entry_id: entryId,
        user_id: user.id,
        match_id: matchId,
        predicted_home: home,
        predicted_away: away,
      }, { onConflict: 'entry_id,match_id' })

    setSaving(s => ({ ...s, [matchId]: false }))
    setSaved(s => ({ ...s, [matchId]: true }))
    setTimeout(() => setSaved(s => ({ ...s, [matchId]: false })), 2000)
  }, [entryId])

  function handleScore(matchId: number, side: 'home' | 'away', value: string) {
    const num = value === '' ? null : Math.max(0, Math.min(20, parseInt(value) || 0))
    const current = predictions[matchId] ?? { match_id: matchId, predicted_home: null, predicted_away: null, points_earned: null }
    const updated = {
      ...current,
      predicted_home: side === 'home' ? num : current.predicted_home,
      predicted_away: side === 'away' ? num : current.predicted_away,
    }
    setPredictions(p => ({ ...p, [matchId]: updated }))

    const newHome = side === 'home' ? num : current.predicted_home
    const newAway = side === 'away' ? num : current.predicted_away
    if (newHome !== null && newAway !== null) {
      savePrediction(matchId, newHome, newAway)
    }
  }

  // Agrupar partidos por fecha
  const matchesByDate: Record<string, Match[]> = {}
  matches.forEach(m => {
    const { dayStr } = formatDate(m.match_date)
    if (!matchesByDate[dayStr]) matchesByDate[dayStr] = []
    matchesByDate[dayStr].push(m)
  })

  const totalPredictions = Object.keys(predictions).filter(
    k => predictions[Number(k)].predicted_home !== null
  ).length

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Cargando partidos...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <NavMenu />
            <div>
              <p className="font-bold text-gray-900">{entryName}</p>
              <p className="text-xs text-gray-400">{totalPredictions} / 72 pronósticos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 bg-gray-100 rounded-full h-2">
              <div className="h-2 rounded-full transition-all"
                style={{ width: `${(totalPredictions / 72) * 100}%`, backgroundColor: '#006847' }} />
            </div>
            <span className="text-xs text-gray-400">{Math.round((totalPredictions / 72) * 100)}%</span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {Object.entries(matchesByDate).map(([dateStr, dayMatches]) => (
          <div key={dateStr} className="mb-8">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">📅 {dateStr}</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="flex flex-col gap-3">
              {dayMatches.map(match => {
                const locked = isLocked(match.match_date)
                const pred = predictions[match.id]
                const { timeStr } = formatDate(match.match_date)
                const isSaving = saving[match.id]
                const isSaved = saved[match.id]

                return (
                  <div key={match.id}
                    className={`bg-white rounded-2xl border shadow-sm p-4 ${locked ? 'border-gray-100 opacity-70' : 'border-gray-100'}`}>

                    {/* Info */}
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: '#006847' }}>
                        Grupo {match.group_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {timeStr} · {match.city}
                      </span>
                    </div>

                    {/* Equipos y marcador */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-3xl">{match.home_team.flag}</span>
                        <span className="text-xs text-center font-medium text-gray-700 leading-tight">
                          {match.home_team.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input type="number" min="0" max="20" inputMode="numeric" pattern="[0-9]*" disabled={locked}
                          value={pred?.predicted_home ?? ''}
                          onChange={e => handleScore(match.id, 'home', e.target.value)}
                          className="w-12 h-12 text-center text-xl font-bold border-2 rounded-xl outline-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-900"
                          style={{ borderColor: pred?.predicted_home !== null && pred?.predicted_home !== undefined ? '#006847' : '#e5e7eb' }}
                        />
                        <span className="text-gray-300 font-bold text-lg">—</span>
                        <input type="number" min="0" max="20" inputMode="numeric" pattern="[0-9]*" disabled={locked}
                          value={pred?.predicted_away ?? ''}
                          onChange={e => handleScore(match.id, 'away', e.target.value)}
                          className="w-12 h-12 text-center text-xl font-bold border-2 rounded-xl outline-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-900"
                          style={{ borderColor: pred?.predicted_away !== null && pred?.predicted_away !== undefined ? '#006847' : '#e5e7eb' }}
                        />
                      </div>

                      <div className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-3xl">{match.away_team.flag}</span>
                        <span className="text-xs text-center font-medium text-gray-700 leading-tight">
                          {match.away_team.name}
                        </span>
                      </div>
                    </div>

                    {/* Estado */}
                    <div className="mt-3 flex items-center justify-center gap-2">
                      {/* Badge de puntos si el partido terminó */}
                      {match.status === 'finished' && (
                        <div className="flex items-center gap-2">
                          {/* Resultado real */}
                          <span className="text-xs text-gray-400">
                            Real: {match.home_score} — {match.away_score}
                          </span>
                          {/* Badge */}
                          {pred?.points_earned === 3 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                              +3 🎯
                            </span>
                          )}
                          {pred?.points_earned === 1 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                              +1 ✓
                            </span>
                          )}
                          {pred?.points_earned === 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-400">
                              +0 ✗
                            </span>
                          )}
                          {pred?.points_earned === null && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                              Sin pronóstico
                            </span>
                          )}
                        </div>
                      )}

                      {/* Estado normal si no ha terminado */}
                      {match.status !== 'finished' && (
                        <span className="text-xs">
                          {locked ? (
                            <span className="text-red-400 font-medium">🔒 Cerrado</span>
                          ) : isSaving ? (
                            <span className="text-yellow-500">Guardando...</span>
                          ) : isSaved ? (
                            <span className="font-medium" style={{ color: '#006847' }}>✓ Guardado</span>
                          ) : pred?.predicted_home !== null && pred?.predicted_home !== undefined ? (
                            <span className="text-gray-400">✓ Capturado</span>
                          ) : (
                            <span className="text-gray-300">Ingresa tu pronóstico</span>
                          )}
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