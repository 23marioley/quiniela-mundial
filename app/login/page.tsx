'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Link from 'next/link'

const FRASES = [
  "El fútbol no se juega con los pies, se juega con el corazón. ❤️",
  "La pelota no se mancha. ⚽",
  "En el fútbol, como en la vida, el equipo siempre gana unido. 🏆",
  "No hay presión, solo fútbol. 🌍",
  "El mejor momento para meter un gol es siempre. 🥅",
  "El fútbol es el deporte más hermoso del mundo. 🌟",
  "Juega bonito, vive bonito. ✨",
  "La magia del fútbol está en lo inesperado. 🎯",
  "Al margen del resultado, ¡pártanse la madre! 💪",
  "Solo hay dos cosas seguras en esta vida: la muerte y un penal para el América.",
  "El fútbol es lo más importante de lo menos importante. ⚽"
]

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ identifier?: string; password?: string; general?: string }>({})
  const [loading, setLoading] = useState(false)
  const [frase, setFrase] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    setFrase(FRASES[Math.floor(Math.random() * FRASES.length)])
  }, [])

  function validate() {
    const newErrors: { identifier?: string; password?: string } = {}
    const isEmail = identifier.includes('@')

    if (!identifier.trim()) {
      newErrors.identifier = 'Ingresa tu correo o nombre de usuario'
    } else if (!isEmail && !/^[a-zA-Z0-9_]+$/.test(identifier)) {
      newErrors.identifier = 'El nombre de usuario solo puede tener letras, números y guión bajo'
    } else if (!isEmail && identifier.length < 3) {
      newErrors.identifier = 'El nombre de usuario debe tener al menos 3 caracteres'
    }

    if (!password) {
      newErrors.password = 'Ingresa tu contraseña'
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setErrors({})

    const isEmail = identifier.includes('@')
    let emailToUse = identifier.trim()

    // Si es username, buscar el correo
    if (!isEmail) {
      const { data: email } = await supabase
        .rpc('get_email_by_username', { p_username: identifier.trim().toLowerCase() })

      if (!email) {
        setErrors({ identifier: 'No existe ningún usuario con ese nombre' })
        setLoading(false)
        return
      }

      emailToUse = email
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password
    })

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErrors({ general: 'Contraseña incorrecta' })
      } else {
        setErrors({ general: 'Error al iniciar sesión, intenta de nuevo' })
      }
      setLoading(false)
      return
    }

    router.push('/mis-quinielas')
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #006847 0%, #004d35 40%, #1e3a5f 100%)' }}>

      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-10 bg-white" />
        <div className="absolute top-40 -right-10 w-48 h-48 rounded-full opacity-10 bg-white" />
        <div className="absolute bottom-20 left-10 w-32 h-32 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-10 right-20 w-56 h-56 rounded-full opacity-5 bg-white" />
      </div>

      {/* Header decorativo */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">

        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-full overflow-hidden shadow-2xl border-4 border-white/20">
              <img src="/trionda.png" alt="Trionda FIFA 2026" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
              style={{ backgroundColor: '#dc2626' }}>
              2026
            </div>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Quiniela</h1>
          <p className="text-green-200 font-semibold text-lg">Mundial 2026</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-xl text-white">🇲🇽</span>
            <span className="text-green-300 text-xs">·</span>
            <span className="text-xl text-white">🇨🇦</span>
            <span className="text-green-300 text-xs">·</span>
            <span className="text-xl text-white">🇺🇸</span>
          </div>
          {frase && (
            <p className="text-green-200 text-xs italic mt-3 max-w-xs mx-auto opacity-80">
              "{frase}"
            </p>
          )}
        </div>

        {/* Card */}
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-7">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Bienvenido 👋</h2>
            <p className="text-gray-400 text-sm mb-6">Inicia sesión para ver tus quinielas</p>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">

              {/* Identifier */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Correo o usuario
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setErrors({}) }}
                  className={`w-full border-2 rounded-xl px-4 py-3 text-gray-900 outline-none transition-colors ${errors.identifier ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-green-500'
                    }`}
                  placeholder="tu@correo.com o tu_usuario"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                {errors.identifier && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                    <span>⚠️</span> {errors.identifier}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrors({}) }}
                    className={`w-full border-2 rounded-xl px-4 py-3 pr-12 text-gray-900 outline-none transition-colors ${errors.password ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-green-500'
                      }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><span>⚠️</span> {errors.password}</p>}
              </div>

              {errors.general && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-red-500 text-sm flex items-center gap-2">
                    <span>⚠️</span> {errors.general}
                  </p>
                </div>
              )}

              {/* Botón */}
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-60 mt-1 flex items-center justify-center gap-2 shadow-lg"
                style={{ background: loading ? '#004d35' : 'linear-gradient(135deg, #006847, #004d35)' }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Entrando...
                  </>
                ) : (
                  'Entrar ⚽'
                )}
              </button>

              <p className="text-center text-gray-400 text-sm">
                ¿No tienes cuenta?{' '}
                <Link href="/registro" className="font-bold" style={{ color: '#006847' }}>
                  Regístrate
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pb-6">
        <p className="text-green-300 text-xs opacity-60">Quiniela Mundial 2026 · Hecho por Mario Jr</p>
      </div>
    </main>
  )
}