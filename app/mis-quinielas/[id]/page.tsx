'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import NavMenu, { UserChip } from '../../components/NavMenu'
import Link from 'next/link'


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

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const DEADLINE = new Date('2026-06-11T09:00:00Z') // 10 horas antes del primer partido

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

const torneoAbierto = new Date() < DEADLINE

export default function QuinielaPage() {
  const router = useRouter()
  const params = useParams()
  const entryId = Number(params.id)
  const supabase = createClient()

  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Record<number, Prediction>>({})
  const [savedPredictions, setSavedPredictions] = useState<Record<number, Prediction>>({})
  const [entryName, setEntryName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [editing, setEditing] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: entry } = await supabase
      .from('entries')
      .select('id, name, user_id')
      .eq('id', entryId)
      .single()

    if (!entry || entry.user_id !== user.id) { router.push('/mis-quinielas'); return }
    setEntryName(entry.name)

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
      const formatted = matchesData.map((m: any) => ({
        ...m,
        group_name: m.groups?.name ?? '',
        home_team: m.home_team,
        away_team: m.away_team,
      }))
      setMatches(formatted)
    }

    const { data: predsData } = await supabase
      .from('predictions')
      .select('match_id, predicted_home, predicted_away, points_earned')
      .eq('entry_id', entryId)

    if (predsData && predsData.length > 0) {
      const map: Record<number, Prediction> = {}
      predsData.forEach((p: any) => { map[p.match_id] = p })
      setPredictions(map)
      setSavedPredictions(map)
      setSubmitted(true)
    }

    setLoading(false)
  }

  async function handleSubmit() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const toUpsert = Object.values(predictions)
      .filter(p => p.predicted_home !== null && p.predicted_away !== null)
      .map(p => ({
        entry_id: entryId,
        user_id: user.id,
        match_id: p.match_id,
        predicted_home: p.predicted_home,
        predicted_away: p.predicted_away,
      }))

    if (toUpsert.length === 0) {
      setSaving(false)
      return
    }

    await supabase
      .from('predictions')
      .upsert(toUpsert, { onConflict: 'entry_id,match_id' })

    setSavedPredictions({ ...predictions })
    setSubmitted(true)
    setEditing(false)
    setSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  function handleScore(matchId: number, side: 'home' | 'away', value: string) {
    const num = value === '' ? null : Math.max(0, Math.min(20, parseInt(value) || 0))
    const current = predictions[matchId] ?? { match_id: matchId, predicted_home: null, predicted_away: null, points_earned: null }
    setPredictions(p => ({
      ...p,
      [matchId]: {
        ...current,
        predicted_home: side === 'home' ? num : current.predicted_home,
        predicted_away: side === 'away' ? num : current.predicted_away,
      }
    }))
  }

  const matchesByDate: Record<string, Match[]> = {}
  matches.forEach(m => {
    const { dayStr } = formatDate(m.match_date)
    if (!matchesByDate[dayStr]) matchesByDate[dayStr] = []
    matchesByDate[dayStr].push(m)
  })

  const totalFilled = Object.values(predictions).filter(
    p => p.predicted_home !== null && p.predicted_away !== null
  ).length

  const isEditable = torneoAbierto && (!submitted || editing)

  if (loading) return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Cargando partidos...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <NavMenu />
            <div>
              <p className="font-bold text-gray-900">{entryName}</p>
              <p className="text-xs text-gray-400">{totalFilled} / 72 pronósticos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 bg-gray-100 rounded-full h-2">
              <div className="h-2 rounded-full transition-all"
                style={{ width: `${(totalFilled / 72) * 100}%`, backgroundColor: '#006847' }} />
            </div>
            <UserChip />
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Banner de estado */}
        {!torneoAbierto && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 text-center">
            <p className="text-red-600 font-semibold">🔒 El torneo ya comenzó</p>
            <p className="text-red-400 text-sm mt-1">Los pronósticos ya no se pueden modificar</p>
          </div>
        )}

        {torneoAbierto && submitted && !editing && (
          <div className="border rounded-2xl p-4 mb-6 text-center"
            style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <p className="font-semibold" style={{ color: '#006847' }}>✓ Pronósticos enviados</p>
            <p className="text-green-600 text-sm mt-1">{totalFilled} partidos capturados — puedes editar hasta el 11 jun a las 3:00 am</p>
          </div>
        )}

        {/* Partidos */}
        {Object.entries(matchesByDate).map(([dateStr, dayMatches]) => (
          <div key={dateStr} className="mb-8">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">📅 {dateStr}</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="flex flex-col gap-3">
              {dayMatches.map(match => {
                const pred = predictions[match.id]
                const { timeStr } = formatDate(match.match_date)
                const pts = pred?.points_earned

                return (
                  <div key={match.id}
                    className={`bg-white rounded-2xl border shadow-sm p-4 ${
                      !isEditable ? 'border-gray-100 opacity-80' : 'border-gray-100'
                    }`}>

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
                        <input type="number" min="0" max="20"
                          inputMode="numeric" pattern="[0-9]*"
                          disabled={!isEditable}
                          value={pred?.predicted_home ?? ''}
                          onChange={e => handleScore(match.id, 'home', e.target.value)}
                          className="w-12 h-12 text-center text-xl font-bold border-2 rounded-xl outline-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-900"
                          style={{ borderColor: pred?.predicted_home !== null && pred?.predicted_home !== undefined ? '#006847' : '#e5e7eb' }}
                        />
                        <span className="text-gray-300 font-bold text-lg">—</span>
                        <input type="number" min="0" max="20"
                          inputMode="numeric" pattern="[0-9]*"
                          disabled={!isEditable}
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
                      {match.status === 'finished' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            Real: {match.home_score} — {match.away_score}
                          </span>
                          {pts === 3 && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">+3 🎯</span>}
                          {pts === 1 && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">+1 ✓</span>}
                          {pts === 0 && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-400">+0 ✗</span>}
                          {pts === null && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-400">Sin pronóstico</span>}
                        </div>
                      )}
                      {match.status !== 'finished' && (
                        <span className="text-xs">
                          {!isEditable ? (
                            <span className="text-red-400 font-medium">🔒 Cerrado</span>
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

        {/* Botones de acción */}
        {torneoAbierto && (
          <div className="sticky bottom-4 flex flex-col gap-3 mt-4">
            {(!submitted || editing) && (
              <button
                onClick={handleSubmit}
                disabled={saving || totalFilled === 0}
                className="w-full text-white font-bold py-4 rounded-2xl shadow-lg transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#006847' }}
              >
                {saving ? 'Guardando...' : saveSuccess ? '✓ ¡Pronósticos guardados!' : `⚽ Enviar pronósticos (${totalFilled}/72)`}
              </button>
            )}

            {submitted && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="w-full font-bold py-4 rounded-2xl shadow-lg transition-opacity border-2 bg-white flex items-center justify-center gap-2"
                style={{ borderColor: '#006847', color: '#006847' }}
              >
                ✏️ Editar pronósticos
              </button>
            )}

            {editing && (
              <button
                onClick={() => {
                  setPredictions({ ...savedPredictions })
                  setEditing(false)
                }}
                className="w-full font-bold py-4 rounded-2xl shadow-lg transition-opacity border-2 bg-white text-gray-500 border-gray-200 flex items-center justify-center gap-2"
              >
                ✕ Cancelar edición
              </button>
            )}
          </div>
        )}

      </div>
    </main>
  )
}