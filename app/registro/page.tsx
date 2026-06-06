'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Link from 'next/link'

const FRASES = [
  "El fútbol no se juega con los pies, se juega con el corazón. ❤️",
  "La pelota no se mancha. ⚽",
  "En el fútbol, como en la vida, el equipo siempre gana solo. 🏆",
  "No hay presión, solo fútbol. 🌍",
  "El mejor momento para meter un gol es siempre. 🥅",
  "El fútbol es el deporte más hermoso del mundo. 🌟",
  "Juega bonito, vive bonito. ✨",
  "La magia del fútbol está en lo inesperado. 🎯",
]

export default function RegistroPage() {
  const router = useRouter()
  const supabase = createClient()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [groupCode, setGroupCode] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [frase, setFrase] = useState('')

  useEffect(() => {
    setFrase(FRASES[Math.floor(Math.random() * FRASES.length)])
  }, [])

  function validate() {
    const newErrors: Record<string, string> = {}
    if (!groupCode.trim()) newErrors.groupCode = 'Ingresa el código de grupo'
    if (!username.trim()) newErrors.username = 'Ingresa un nombre de usuario'
    else if (username.length < 3) newErrors.username = 'Debe tener al menos 3 caracteres'
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) newErrors.username = 'Solo letras, números y guión bajo. Sin espacios'
    if (!email.trim()) newErrors.email = 'Ingresa tu correo'
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'El correo no es válido'
    if (!password) newErrors.password = 'Ingresa una contraseña'
    else if (password.length < 6) newErrors.password = 'Debe tener al menos 6 caracteres'
    if (!confirm) newErrors.confirm = 'Confirma tu contraseña'
    else if (password !== confirm) newErrors.confirm = 'Las contraseñas no coinciden'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    const { data: group } = await supabase
      .from('pool_groups')
      .select('id, name')
      .ilike('code', groupCode.trim())
      .maybeSingle()

    if (!group) {
      setErrors({ groupCode: 'Código de grupo incorrecto' })
      setLoading(false)
      return
    }

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle()

    if (existing) {
      setErrors({ username: 'Ese nombre de usuario ya está tomado' })
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: username } }
    })

    if (signUpError) {
      setErrors({ general: 'Error al crear la cuenta: ' + signUpError.message })
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase
        .from('profiles')
        .update({
          username: username.toLowerCase(),
          display_name: username,
          pool_group_id: group.id
        })
        .eq('id', data.user.id)
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

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">

        {/* Logo */}
        <div className="text-center mb-6">
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
            <h2 className="text-xl font-bold text-gray-900 mb-1">Crear cuenta 🏆</h2>
            <p className="text-gray-400 text-sm mb-6">Únete a la quiniela del Mundial</p>

            <form onSubmit={handleRegistro} className="flex flex-col gap-4">

              {/* Código de grupo */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Código de grupo</label>
                <input
                  type="text" value={groupCode}
                  onChange={e => { setGroupCode(e.target.value); setErrors({}) }}
                  className={`w-full border-2 rounded-xl px-4 py-3 text-gray-900 outline-none transition-colors uppercase ${
                    errors.groupCode ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-green-500'
                  }`}
                  placeholder="Ej. FAMILIA2026"
                  autoCapitalize="characters"
                />
                {errors.groupCode && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><span>⚠️</span> {errors.groupCode}</p>}
                <p className="text-xs text-gray-400 mt-1">Pídele el código al organizador.</p>
              </div>

              {/* Username */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Nombre de usuario</label>
                <input
                  type="text" value={username}
                  onChange={e => { setUsername(e.target.value); setErrors({}) }}
                  className={`w-full border-2 rounded-xl px-4 py-3 text-gray-900 outline-none transition-colors ${
                    errors.username ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-green-500'
                  }`}
                  placeholder="ej. mario_ley"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                {errors.username && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><span>⚠️</span> {errors.username}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Correo</label>
                <input
                  type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setErrors({}) }}
                  className={`w-full border-2 rounded-xl px-4 py-3 text-gray-900 outline-none transition-colors ${
                    errors.email ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-green-500'
                  }`}
                  placeholder="tu@correo.com"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><span>⚠️</span> {errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Contraseña</label>
                <input
                  type="password" value={password}
                  onChange={e => { setPassword(e.target.value); setErrors({}) }}
                  className={`w-full border-2 rounded-xl px-4 py-3 text-gray-900 outline-none transition-colors ${
                    errors.password ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-green-500'
                  }`}
                  placeholder="Mínimo 6 caracteres"
                />
                {errors.password && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><span>⚠️</span> {errors.password}</p>}
              </div>

              {/* Confirm */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Confirmar contraseña</label>
                <input
                  type="password" value={confirm}
                  onChange={e => { setConfirm(e.target.value); setErrors({}) }}
                  className={`w-full border-2 rounded-xl px-4 py-3 text-gray-900 outline-none transition-colors ${
                    errors.confirm ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-green-500'
                  }`}
                  placeholder="Repite tu contraseña"
                />
                {errors.confirm && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><span>⚠️</span> {errors.confirm}</p>}
              </div>

              {errors.general && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-red-500 text-sm flex items-center gap-2"><span>⚠️</span> {errors.general}</p>
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-60 mt-1 flex items-center justify-center gap-2 shadow-lg"
                style={{ background: loading ? '#004d35' : 'linear-gradient(135deg, #006847, #004d35)' }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Creando cuenta...
                  </>
                ) : (
                  'Crear cuenta ⚽'
                )}
              </button>

              <p className="text-center text-gray-400 text-sm">
                ¿Ya tienes cuenta?{' '}
                <Link href="/login" className="font-bold" style={{ color: '#006847' }}>
                  Inicia sesión
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>

      <div className="relative z-10 text-center pb-6">
        <p className="text-green-300 text-xs opacity-60">Quiniela Mundial 2026 · Hecho por Mario Jr</p>
      </div>
    </main>
  )
}