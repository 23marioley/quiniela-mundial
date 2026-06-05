'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Link from 'next/link'
import NavMenu from '../components/NavMenu'

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
}

export default function RankingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [rankings, setRankings] = useState<RankingEntry[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
    <span className="text-2xl">🏆</span>
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
                        🎯 {entry.exact_scores} · ✓ {entry.correct_results}
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
            🎯 Marcador exacto = 3 pts &nbsp;·&nbsp; ✓ Resultado correcto = 1 pt
          </p>
        </div>

      </div>
    </main>
  )
}