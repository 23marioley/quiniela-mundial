'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Link from 'next/link'
import NavMenu from '../components/NavMenu'

type Entry = { id: number; name: string; created_at: string; predictions_count: number }

export default function MisQuinielasPage() {
  const router = useRouter()
  const supabase = createClient()
  const [entries, setEntries] = useState<Entry[]>([])
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const PRECIO = 200

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles').select('display_name').eq('id', user.id).single()
    if (profile) setDisplayName(profile.display_name)

    const { data: entriesData } = await supabase
      .from('entries')
      .select('id, name, created_at, predictions(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (entriesData) {
      setEntries(entriesData.map((e: any) => ({
        id: e.id, name: e.name, created_at: e.created_at,
        predictions_count: e.predictions?.[0]?.count ?? 0
      })))
    }
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const torneoAbierto = new Date() < new Date('2026-06-11T09:00:00Z')

  if (loading) return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Cargando...</p>
    </main>
  )

  async function handleDelete(entryId: number) {
  const confirm = window.confirm('¿Seguro que quieres eliminar esta quiniela? Se borrarán todos sus pronósticos.')
  if (!confirm) return

  await supabase
    .from('predictions')
    .delete()
    .eq('entry_id', entryId)

  await supabase
    .from('entries')
    .delete()
    .eq('id', entryId)

  setEntries(prev => prev.filter(e => e.id !== entryId))
}

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <NavMenu />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                style={{ background: 'linear-gradient(135deg, #006847, #2563eb)' }}>⚽</div>
              <span className="font-bold text-gray-900">Mundial 2026</span>
            </div>
          </div>
          <Link href="/rankings" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
            🏆 Rankings
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Hola, {displayName} 👋</h1>
        <p className="text-gray-500 mb-8">Tus quinielas del Mundial 2026</p>

        {/* Quinielas */}
        {entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center mb-6">
            <div className="text-5xl mb-4">🏆</div>
            <p className="font-semibold text-gray-900 text-lg mb-1">Aún no tienes quinielas</p>
            <p className="text-gray-400 text-sm">Crea tu primera quiniela para empezar</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-6">
            {entries.map((entry, i) => {
              const torneoAbierto = new Date() < new Date('2026-06-11T09:00:00Z')
              return (
                <div key={entry.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-green-200 hover:shadow-md transition-all">
                  <Link href={`/mis-quinielas/${entry.id}`} className="p-5 flex justify-between items-center block">
                    <div>
                      <p className="font-semibold text-gray-900">{entry.name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${(entry.predictions_count / 72) * 100}%`, backgroundColor: '#006847' }} />
                        </div>
                        <span className="text-xs text-gray-400">{entry.predictions_count}/72</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">#{i + 1}</span>
                      <span className="text-gray-300">›</span>
                    </div>
                  </Link>

                  {/* Botón eliminar */}
                  {torneoAbierto && (
                    <div className="px-5 pb-4">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        🗑️ Eliminar quiniela
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Botón agregar */}
        {torneoAbierto ? (
          <Link href="/mis-quinielas/nueva"
            className="w-full text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#006847' }}>
            + Agregar quiniela
          </Link>
        ) : (
          <div className="w-full bg-gray-100 text-gray-400 font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed">
            🔒 El torneo ya comenzó
          </div>
        )}

        {/* Resumen de pago */}
        {entries.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">Tu participación</p>
              <p className="font-semibold text-gray-900 mt-0.5">
                {entries.length} {entries.length === 1 ? 'quiniela' : 'quinielas'} × $200
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total a pagar</p>
              <p className="text-2xl font-bold" style={{ color: '#006847' }}>
                ${entries.length * PRECIO}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}