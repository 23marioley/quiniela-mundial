'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Link from 'next/link'
import NavMenu, { UserChip } from '../components/NavMenu'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

type RankingEntry = {
  entry_id: number
  user_id: string
  display_name: string
  entry_name: string
  total_points: number
  exact_scores: number
  correct_results: number
  matches_played: number
  position: number
  avatar_url?: string
}

type HistoryPoint = {
  match_id: number
  match_number: number
  position: number
  total_points: number
}

type EntryHistory = {
  entry_id: number
  user_id: string
  display_name: string
  entry_name: string
  avatar_url?: string
  color: string
  history: HistoryPoint[]
}

export default function RankingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [rankings, setRankings] = useState<RankingEntry[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [histories, setHistories] = useState<EntryHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [xWindow, setXWindow] = useState({ start: 1, end: 10 })
  const maxMatch = Math.max(...histories.flatMap(h => h.history.map(p => p.match_number)), 10)
  const windowSize = 10
  const canGoLeft = xWindow.start > 1
  const canGoRight = xWindow.end < maxMatch

  function toggleEntry(id: number) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function shiftWindow(dir: 'left' | 'right') {
    setXWindow(w => {
      const delta = dir === 'right' ? windowSize : -windowSize
      const newStart = Math.max(1, Math.min(maxMatch - windowSize + 1, w.start + delta))
      const newEnd = newStart + windowSize - 1
      return { start: newStart, end: newEnd }
    })
  }
  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setCurrentUserId(user.id)

    const { data } = await supabase
      .from('rankings')
      .select('*')
      .order('position', { ascending: true })

    if (data) setRankings(data)
    setLoading(false)

    await loadHistory()

  }

  // const COLORS = [
  //   '#006847', '#dc2626', '#2563eb', '#d97706', '#7c3aed',
  //   '#db2777', '#0891b2', '#65a30d', '#ea580c', '#6366f1',
  //   '#14b8a6', '#f43f5e', '#8b5cf6', '#06b6d4', '#84cc16'
  // ]

  const COLORS = [
    '#006847', // verde FIFA
    '#dc2626', // rojo
    '#f59e0b', // amarillo ámbar
    '#2563eb', // azul
    '#db2777', // rosa fuerte
    '#7c3aed', // morado
    '#ea580c', // naranja
    '#0d9488', // teal
    '#84cc16', // verde lima
    '#be185d', // magenta oscuro
    '#0369a1', // azul marino
    '#b45309', // café dorado
    '#15803d', // verde bosque
    '#7e22ce', // violeta oscuro
    '#e11d48', // rojo rosado
  ]

  async function loadHistory() {
    setLoadingHistory(true)

    const { data: historyData } = await supabase
      .from('ranking_history')
      .select('match_id, entry_id, user_id, position, total_points')
      .order('match_id', { ascending: true })

    if (!historyData || historyData.length === 0) {
      setLoadingHistory(false)
      return
    }

    // Agrupar por entry_id
    const entriesMap: Record<number, HistoryPoint[]> = {}
    historyData.forEach((h: any) => {
      if (!entriesMap[h.entry_id]) entriesMap[h.entry_id] = []
      entriesMap[h.entry_id].push({
        match_id: h.match_id,
        match_number: 0,
        position: h.position,
        total_points: h.total_points
      })
    })

    // Obtener match numbers
    const matchIds = [...new Set(historyData.map((h: any) => h.match_id))]
    const { data: matchesData } = await supabase
      .from('matches')
      .select('id, match_number')
      .in('id', matchIds)

    const matchNumberMap: Record<number, number> = {}
    matchesData?.forEach((m: any) => { matchNumberMap[m.id] = m.match_number })

    // Actualizar match_number en history
    Object.values(entriesMap).forEach(points => {
      points.forEach(p => { p.match_number = matchNumberMap[p.match_id] ?? 0 })
      points.sort((a, b) => a.match_number - b.match_number)
    })

    // Combinar con rankings para obtener nombres y avatars
    const { data: rankingsData } = await supabase
      .from('rankings')
      .select('entry_id, user_id, display_name, entry_name, avatar_url')

    const formatted: EntryHistory[] = (rankingsData ?? []).map((r: any, index: number) => ({
      entry_id: r.entry_id,
      user_id: r.user_id,
      display_name: r.display_name,
      entry_name: r.entry_name,
      avatar_url: r.avatar_url,
      color: COLORS[index % COLORS.length],
      history: entriesMap[r.entry_id] ?? []
    })).filter(e => e.history.length > 0)

    setHistories(formatted)
    setLoadingHistory(false)
  }

  function getMedal(position: number) {
    if (position === 1) return '🥇'
    if (position === 2) return '🥈'
    if (position === 3) return '🥉'
    return null
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Cargando rankings...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NavMenu />
            <div>
              <p className="font-bold text-gray-900">Rankings</p>
              <p className="text-xs text-gray-400">{rankings.length} quinielas registradas</p>
            </div>
          </div>
          <UserChip />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Podio top 3 */}
        {rankings.length >= 3 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider text-center mb-5">Top 3</h2>
            <div className="flex items-end justify-center gap-4">

              {/* 2do lugar */}
              <div className="flex flex-col items-center gap-2 pb-2">
                <span className="text-3xl">🥈</span>
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-300">
                  {rankings[1].avatar_url ? (
                    <img src={rankings[1].avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">👤</span>
                  )}
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900 text-sm">{rankings[1].display_name}</p>
                  <p className="text-xs text-gray-400">{rankings[1].entry_name}</p>
                  <p className="font-bold text-lg text-gray-700">{rankings[1].total_points} pts</p>
                </div>
                <div className="w-20 bg-gray-100 rounded-t-xl h-16 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-400">2</span>
                </div>
              </div>

              {/* 1er lugar */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-4xl">🥇</span>
                <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-yellow-400">
                  {rankings[0].avatar_url ? (
                    <img src={rankings[0].avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">👤</span>
                  )}
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900">{rankings[0].display_name}</p>
                  <p className="text-xs text-gray-400">{rankings[0].entry_name}</p>
                  <p className="font-bold text-2xl" style={{ color: '#006847' }}>{rankings[0].total_points} pts</p>
                </div>
                <div className="w-20 rounded-t-xl h-24 flex items-center justify-center"
                  style={{ backgroundColor: '#006847' }}>
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
              </div>

              {/* 3er lugar */}
              <div className="flex flex-col items-center gap-2 pb-4">
                <span className="text-3xl">🥉</span>
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-amber-600">
                  {rankings[2].avatar_url ? (
                    <img src={rankings[2].avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">👤</span>
                  )}
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900 text-sm">{rankings[2].display_name}</p>
                  <p className="text-xs text-gray-400">{rankings[2].entry_name}</p>
                  <p className="font-bold text-lg text-gray-700">{rankings[2].total_points} pts</p>
                </div>
                <div className="w-20 bg-gray-100 rounded-t-xl h-10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-400">3</span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Lista completa */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">Tabla completa</h2>
          </div>

          {rankings.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-gray-400">Aún no hay quinielas registradas</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {rankings.map(entry => {
                const isMe = entry.user_id === currentUserId
                const medal = getMedal(Number(entry.position))

                return (
                  <div key={entry.entry_id}
                    className={`px-5 py-4 flex items-center gap-4 ${isMe ? 'bg-green-50' : ''}`}>

                    {/* Posición */}
                    <div className="w-8 text-center">
                      {medal ? (
                        <span className="text-xl">{medal}</span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-400">#{entry.position}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-base">👤</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{entry.display_name}</p>
                        {isMe && (
                          <span className="text-xs px-2 py-0.5 rounded-full text-white flex-shrink-0"
                            style={{ backgroundColor: '#006847' }}>tú</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{entry.entry_name}</p>
                    </div>

                    {/* Stats */}
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-900">{entry.total_points} pts</p>
                      <p className="text-xs text-gray-400">
                        🎯 {entry.exact_scores} · ✅ {entry.correct_results}
                      </p>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 text-center">
            🎯 Marcador exacto = 3 pts &nbsp;·&nbsp; ✅ Resultado correcto = 1 pt
          </p>
        </div>

        {/* Gráfica de progreso */}
        {!loadingHistory && histories.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="mb-4">
              <h2 className="font-bold text-gray-900">Progreso por partido</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedIds.length === 0 ? 'Mostrando todos — toca un nombre para filtrar' : `${selectedIds.length} seleccionado${selectedIds.length > 1 ? 's' : ''} — toca para quitar`}
              </p>
            </div>

            {/* Leyenda */}
            <div className="flex flex-wrap gap-2 mb-4">
              {histories.map(h => {
                const isSelected = selectedIds.length === 0 || selectedIds.includes(h.entry_id)
                return (
                  <button
                    key={h.entry_id}
                    onClick={() => toggleEntry(h.entry_id)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full border transition-all text-xs font-medium"
                    style={{
                      borderColor: isSelected ? h.color : '#e5e7eb',
                      backgroundColor: isSelected ? h.color + '15' : 'transparent',
                      color: isSelected ? h.color : '#9ca3af',
                      opacity: isSelected ? 1 : 0.4
                    }}
                  >
                    {h.avatar_url ? (
                      <img src={h.avatar_url} className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs"
                        style={{ backgroundColor: h.color }}>
                        {h.display_name[0]}
                      </span>
                    )}
                    {h.display_name}
                  </button>
                )
              })}
            </div>

            {/* Navegación ventana */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => shiftWindow('left')}
                disabled={!canGoLeft}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-xs text-gray-400 font-medium">
                Partidos {xWindow.start}–{Math.min(xWindow.end, maxMatch)} de {maxMatch}
              </span>
              <button
                onClick={() => shiftWindow('right')}
                disabled={!canGoRight}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente →
              </button>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="match_number"
                  type="number"
                  domain={[xWindow.start, xWindow.end]}
                  tickCount={windowSize}
                  label={{ value: 'Partido', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#9ca3af' }}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                />
                <YAxis
                  reversed
                  tickCount={histories.length + 1}
                  domain={[1, histories.length]}
                  label={{ value: 'Posición', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#9ca3af' }}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
                        <p className="font-semibold text-gray-700 mb-2">Partido #{payload[0]?.payload?.match_number}</p>
                        {[...payload].sort((a: any, b: any) => (a.value ?? 0) - (b.value ?? 0)).map((p: any) => (
                          <div key={`${p.dataKey}-${p.name}`} className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                            <span className="text-gray-600">{p.name}:</span>
                            <span className="font-bold" style={{ color: p.color }}>#{p.value}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }}
                />
                {histories.map(h => {
                  const isSelected = selectedIds.length === 0 || selectedIds.includes(h.entry_id)
                  return (
                    <Line
                      key={h.entry_id}
                      data={h.history}
                      type="monotone"
                      dataKey="position"
                      name={h.display_name}
                      stroke={h.color}
                      strokeWidth={isSelected ? (selectedIds.includes(h.entry_id) ? 3 : 1.5) : 0.5}
                      dot={false}
                      activeDot={{ r: 5, fill: h.color }}
                      opacity={isSelected ? 1 : 0.2}
                      connectNulls
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>

            {/* Avatars al final de cada línea */}
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {histories
                .filter(h => selectedIds.length === 0 || selectedIds.includes(h.entry_id))
                .sort((a, b) => {
                  const lastA = a.history[a.history.length - 1]?.position ?? 99
                  const lastB = b.history[b.history.length - 1]?.position ?? 99
                  return lastA - lastB
                })
                .map(h => {
                  const last = h.history[h.history.length - 1]
                  if (!last) return null
                  return (
                    <div key={h.entry_id} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full overflow-hidden border-2 flex items-center justify-center"
                        style={{ borderColor: h.color }}>
                        {h.avatar_url ? (
                          <img src={h.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-white w-full h-full flex items-center justify-center"
                            style={{ backgroundColor: h.color }}>
                            {h.display_name[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{h.display_name}</p>
                        <p className="text-xs" style={{ color: h.color }}>#{last.position} · {last.total_points} pts</p>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}