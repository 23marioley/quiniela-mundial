'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import Link from 'next/link'

export default function NuevaQuinielaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [entriesCount, setEntriesCount] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const creatingRef = useRef(false)
  

  useEffect(() => { loadEntriesCount() }, [])

  async function loadEntriesCount() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { count } = await supabase
      .from('entries').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    setEntriesCount(count ?? 0)
  }

  async function handleCrear() {
    if (creatingRef.current) return
    creatingRef.current = true
    setError('')
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data, error: insertError } = await supabase
      .from('entries')
      .insert({ user_id: user.id, name: `Quiniela #${(entriesCount ?? 0) + 1}` })
      .select().single()

    if (insertError) { setError('Error al crear la quiniela, intenta de nuevo'); setLoading(false); return }
    router.push(`/mis-quinielas/${data.id}`)
  }

  if (entriesCount === null) return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Cargando...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link href="/mis-quinielas" className="text-gray-400 hover:text-gray-900 transition-colors">←</Link>
          <span className="font-semibold text-gray-900">Nueva quiniela</span>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg, #006847, #2563eb)' }}>🏆</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quiniela #{entriesCount + 1}</h1>
          <p className="text-gray-500 text-sm mb-6">
            Vas a capturar tus pronósticos para los 72 partidos de la fase de grupos
          </p>

          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 mb-6 text-left">
            <p>💰 Costo: <span className="font-semibold text-gray-900">$350 pesos</span></p>
            <p className="mt-1">✅ 1 punto por resultado correcto</p>
            <p className="mt-1">🎯 3 puntos por marcador exacto</p>
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <button onClick={handleCrear} disabled={loading}
            className="w-full text-white font-semibold py-4 rounded-xl transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#006847' }}>
            {loading ? 'Creando...' : 'Crear quiniela y capturar pronósticos'}
          </button>
        </div>
      </div>
    </main>
  )
}