'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Link from 'next/link'

export default function RegistroPage() {
  const router = useRouter()
  const supabase = createClient()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (username.length < 3) { setError('El nombre de usuario debe tener al menos 3 caracteres'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Solo letras, números y guión bajo'); return }
    setLoading(true)

    const { data: existing } = await supabase
      .from('profiles').select('id').ilike('username', username).maybeSingle()
    if (existing) { setError('Ese nombre de usuario ya está tomado'); setLoading(false); return }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password, options: { data: { display_name: username } }
    })
    if (signUpError) { setError('Error al crear la cuenta: ' + signUpError.message); setLoading(false); return }

    if (data.user) {
      await supabase.from('profiles')
        .update({ username: username.toLowerCase(), display_name: username })
        .eq('id', data.user.id)
    }
    router.push('/mis-quinielas')
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #006847, #2563eb)' }}>
            <span className="text-3xl">⚽</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Quiniela Mundial 2026</h1>
          <p className="text-gray-500 mt-1 text-sm">🇲🇽 🇨🇦 🇺🇸</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Crear cuenta</h2>

          <form onSubmit={handleRegistro} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nombre de usuario</label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="ej. mario_ley"
              />
              <p className="text-xs text-gray-400 mt-1">Solo letras, números y guión bajo.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Correo</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="tu@correo.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Contraseña</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Confirmar contraseña</label>
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="Repite tu contraseña"
              />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full text-white font-semibold py-3 rounded-xl transition-opacity disabled:opacity-60 mt-2"
              style={{ backgroundColor: '#006847' }}
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>

            <p className="text-center text-gray-500 text-sm">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="font-semibold" style={{ color: '#006847' }}>
                Inicia sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}