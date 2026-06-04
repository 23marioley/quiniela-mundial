'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import Link from 'next/link'

export default function NuevaQuinielaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [entriesCount, setEntriesCount] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadEntriesCount()
  }, [])

  async function loadEntriesCount() {
    const { data: { user } } = await supabase.auth.getUser()
  console.log('Usuario:', user?.id)
  console.log('Email:', user?.email)
  if (!user) return

    const { count } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    setEntriesCount(count ?? 0)
  }

  async function handleCrear() {
    console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10))
    setError('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const entryName = `Quiniela #${(entriesCount ?? 0) + 1}`

    const { data, error: insertError } = await supabase
      .from('entries')
      .insert({ user_id: user.id, name: entryName })
      .select()
      .single()

    if (insertError) {
      setError('Error al crear la quiniela, intenta de nuevo')
      setLoading(false)
      return
    }

    router.push(`/mis-quinielas/${data.id}`)
  }

  if (entriesCount === null) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link href="/mis-quinielas" className="text-gray-400 hover:text-white transition-colors">
          ← Volver
        </Link>
        <span className="font-bold text-lg">Nueva quiniela</span>
      </header>

      <div className="max-w-md mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏆</div>
          <h1 className="text-2xl font-bold">Quiniela #{entriesCount + 1}</h1>
          <p className="text-gray-400 mt-2 text-sm">
            Se van a capturar los 72 pronósticos de la fase de grupos
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-400 mb-6">
          <p>💰 Esta quiniela tiene un costo de <span className="text-white font-semibold">$200 pesos</span></p>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mb-4">{error}</p>
        )}

        <button
          onClick={handleCrear}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-900 text-white font-semibold py-4 rounded-2xl transition-colors"
        >
          {loading ? 'Creando...' : 'Crear quiniela y capturar pronósticos'}
        </button>
      </div>
    </main>
  )
}