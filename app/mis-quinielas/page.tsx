'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Link from 'next/link'

type Entry = {
  id: number
  name: string
  created_at: string
  total_points: number
  predictions_count: number
}

export default function MisQuinielasPage() {
  const router = useRouter()
  const supabase = createClient()
  const [entries, setEntries] = useState<Entry[]>([])
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const PRECIO_POR_QUINIELA = 200

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    if (profile) setDisplayName(profile.display_name)

    const { data: entriesData } = await supabase
      .from('entries')
      .select(`
        id, name, created_at,
        predictions(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (entriesData) {
      const formatted = entriesData.map((e: any) => ({
        id: e.id,
        name: e.name,
        created_at: e.created_at,
        total_points: 0,
        predictions_count: e.predictions?.[0]?.count ?? 0
      }))
      setEntries(formatted)
    }

    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const torneoAbierto = new Date() < new Date('2026-06-11T19:00:00Z')

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚽</span>
          <span className="font-bold text-lg">Quiniela Mundial 2026</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/rankings" className="text-gray-400 hover:text-white text-sm transition-colors">
            Rankings
          </Link>
          <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm transition-colors">
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-1">Hola, {displayName} 👋</h1>
        <p className="text-gray-400 mb-8">Estas son tus quinielas del Mundial 2026</p>

        {/* Lista de quinielas */}
        {entries.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl p-10 text-center border border-gray-800 mb-6">
            <div className="text-5xl mb-4">🏆</div>
            <p className="text-gray-300 font-semibold text-lg mb-2">Aún no tienes quinielas</p>
            <p className="text-gray-500 text-sm">Crea tu primera quiniela para empezar a jugar</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mb-6">
            {entries.map((entry, index) => (
              <Link
                key={entry.id}
                href={`/mis-quinielas/${entry.id}`}
                className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl p-6 flex justify-between items-center transition-colors"
              >
                <div>
                  <p className="font-semibold text-lg">{entry.name}</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {entry.predictions_count} / 72 pronósticos capturados
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-400">{entry.total_points} pts</p>
                  <p className="text-gray-500 text-xs mt-1">Quiniela #{index + 1}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Botón agregar quiniela */}
        {torneoAbierto ? (
          <Link
            href="/mis-quinielas/nueva"
            className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
          >
            <span className="text-xl">+</span>
            Agregar quiniela
          </Link>
        ) : (
          <div className="w-full bg-gray-800 text-gray-500 font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed">
            <span>🔒</span>
            El torneo ya comenzó, no se pueden agregar más quinielas
          </div>
        )}

        {/* Resumen de pago */}
        {entries.length > 0 && (
          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-5 flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-sm">Tu participación</p>
              <p className="text-white font-semibold mt-1">
                {entries.length} {entries.length === 1 ? 'quiniela' : 'quinielas'} × $200
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">Total a pagar</p>
              <p className="text-green-400 font-bold text-2xl">
                ${entries.length * PRECIO_POR_QUINIELA}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}