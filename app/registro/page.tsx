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

    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (username.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('El nombre de usuario solo puede tener letras, números y guión bajo')
      return
    }

    setLoading(true)

    // Verificar que el username no exista
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle()

    if (existing) {
      setError('Ese nombre de usuario ya está tomado')
      setLoading(false)
      return
    }

    // Crear usuario en Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: username }
      }
    })

    if (signUpError) {
      setError('Error al crear la cuenta: ' + signUpError.message)
      setLoading(false)
      return
    }

    // Actualizar el perfil con username y display_name
    if (data.user) {
      await supabase
        .from('profiles')
        .update({ username: username.toLowerCase(), display_name: username })
        .eq('id', data.user.id)
    }

    router.push('/mis-quinielas')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-xl w-full max-w-md">

        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-2xl font-bold text-white">Crear cuenta</h1>
          <p className="text-gray-400 mt-1">Quiniela Mundial 2026</p>
        </div>

        <form onSubmit={handleRegistro} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Nombre de usuario</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
              placeholder="ej. mario_ley"
            />
            <p className="text-xs text-gray-500 mt-1">Solo letras, números y guión bajo. Sin espacios.</p>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Correo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
              placeholder="tu@correo.com"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Confirmar contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Repite tu contraseña"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-900 text-white font-semibold py-3 rounded-lg transition-colors mt-2"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <p className="text-center text-gray-400 text-sm">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-green-400 hover:text-green-300">
              Inicia sesión
            </Link>
          </p>
        </form>

      </div>
    </main>
  )
}