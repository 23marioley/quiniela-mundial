'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Link from 'next/link'
import NavMenu, { UserChip } from '../components/NavMenu'

type Team = { id: number; name: string; flag: string }
type Match = {
    id: number
    match_number: number
    match_date: string
    city: string
    group_name: string
    home_team: Team
    away_team: Team
    home_score: number | null
    away_score: number | null
    status: string
}

type UserSummary = {
    id: string
    display_name: string
    username: string
    entries_count: number
    total_predictions: number
    total_due: number
    avatar_url?: string
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function formatDate(utcString: string) {
    const d = new Date(utcString)
    const mty = new Date(d.getTime() - 6 * 60 * 60 * 1000)
    const day = DAYS[mty.getUTCDay()]
    const date = mty.getUTCDate()
    const month = MONTHS[mty.getUTCMonth()]
    const hours = mty.getUTCHours()
    const minutes = mty.getUTCMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'pm' : 'am'
    const h = hours % 12 || 12
    return { dayStr: `${day} ${date} ${month}`, timeStr: `${h}:${minutes} ${ampm}` }
}

function isToday(utcString: string) {
    const d = new Date(utcString)
    const mty = new Date(d.getTime() - 6 * 60 * 60 * 1000)
    const now = new Date(Date.now() - 6 * 60 * 60 * 1000)
    return mty.getUTCFullYear() === now.getUTCFullYear() &&
        mty.getUTCMonth() === now.getUTCMonth() &&
        mty.getUTCDate() === now.getUTCDate()
}

export default function AdminPage() {
    const router = useRouter()
    const supabase = createClient()
    const [matches, setMatches] = useState<Match[]>([])
    const [scores, setScores] = useState<Record<number, { home: string; away: string }>>({})
    const [saving, setSaving] = useState<Record<number, boolean>>({})
    const [saved, setSaved] = useState<Record<number, boolean>>({})
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [users, setUsers] = useState<UserSummary[]>([])
    const [activeTab, setActiveTab] = useState<'partidos' | 'usuarios'>('partidos')
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [totalRecaudado, setTotalRecaudado] = useState(0)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const { data: profile } = await supabase
            .from('profiles').select('is_admin').eq('id', user.id).single()

        if (!profile?.is_admin) { router.push('/mis-quinielas'); return }
        setIsAdmin(true)

        const { data: matchesData } = await supabase
            .from('matches')
            .select(`
        id, match_number, match_date, city, status,
        home_score, away_score,
        groups!inner(name),
        home_team:teams!matches_home_team_id_fkey(id, name, flag),
        away_team:teams!matches_away_team_id_fkey(id, name, flag)
      `)
            .order('match_date', { ascending: true })

        if (matchesData) {
            const formatted = matchesData.map((m: any) => ({
                ...m,
                group_name: m.groups?.name ?? '',
                home_team: m.home_team,
                away_team: m.away_team,
            }))
            setMatches(formatted)

            // Pre-llenar scores con valores existentes
            const initialScores: Record<number, { home: string; away: string }> = {}
            formatted.forEach((m: Match) => {
                initialScores[m.id] = {
                    home: m.home_score !== null ? String(m.home_score) : '',
                    away: m.away_score !== null ? String(m.away_score) : '',
                }
            })
            setScores(initialScores)
        }

        setLoading(false)
    }

    async function loadUsers() {
        setLoadingUsers(true)

        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')

        if (!profiles) { setLoadingUsers(false); return }

        const { data: entriesData } = await supabase
            .from('entries')
            .select('id, user_id, predictions(count)')

        const entriesByUser: Record<string, { count: number; predictions: number }> = {}
        entriesData?.forEach((e: any) => {
            if (!entriesByUser[e.user_id]) entriesByUser[e.user_id] = { count: 0, predictions: 0 }
            entriesByUser[e.user_id].count += 1
            entriesByUser[e.user_id].predictions += e.predictions?.[0]?.count ?? 0
        })

        const formatted = profiles.map((p: any) => ({
            id: p.id,
            display_name: p.display_name,
            username: p.username ?? '-',
            entries_count: entriesByUser[p.id]?.count ?? 0,
            total_predictions: entriesByUser[p.id]?.predictions ?? 0,
            total_due: (entriesByUser[p.id]?.count ?? 0) * 200,
            avatar_url: p.avatar_url ?? null
        }))

        const total = formatted.reduce((sum, u) => sum + u.total_due, 0)
        setTotalRecaudado(total)
        setUsers(formatted)
        setLoadingUsers(false)
    }

    async function handleSave(match: Match) {
        const score = scores[match.id]
        if (!score || score.home === '' || score.away === '') return

        setSaving(s => ({ ...s, [match.id]: true }))

        await supabase
            .from('matches')
            .update({
                home_score: parseInt(score.home),
                away_score: parseInt(score.away),
                status: 'finished'
            })
            .eq('id', match.id)

        setSaving(s => ({ ...s, [match.id]: false }))
        setSaved(s => ({ ...s, [match.id]: true }))
        setTimeout(() => setSaved(s => ({ ...s, [match.id]: false })), 2500)

        // Actualizar estado local
        setMatches(ms => ms.map(m => m.id === match.id
            ? { ...m, home_score: parseInt(score.home), away_score: parseInt(score.away), status: 'finished' }
            : m
        ))
    }

    async function handleUndo(matchId: number) {
        const confirm = window.confirm('¿Seguro que quieres deshacer este resultado? Se borrarán los puntos de todos los pronósticos de este partido.')
        if (!confirm) return

        await supabase
            .from('matches')
            .update({
                home_score: null,
                away_score: null,
                status: 'upcoming'
            })
            .eq('id', matchId)

        // Limpiar puntos de todos los pronósticos de este partido
        await supabase
            .from('predictions')
            .update({ points_earned: null })
            .eq('match_id', matchId)

        // Actualizar estado local
        setMatches(ms => ms.map(m => m.id === matchId
            ? { ...m, home_score: null, away_score: null, status: 'upcoming' }
            : m
        ))
        setScores(s => ({ ...s, [matchId]: { home: '', away: '' } }))
    }

    async function handleAvatarUpload(userId: string, file: File) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${userId}.${fileExt}`

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true })

        if (uploadError) { alert('Error al subir la foto'); return }

        const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName)

        await supabase
            .from('profiles')
            .update({ avatar_url: urlData.publicUrl })
            .eq('id', userId)

        // Actualizar estado local
        setUsers(prev => prev.map(u =>
            u.id === userId ? { ...u, avatar_url: urlData.publicUrl } : u
        ))
    }

    // Agrupar por fecha
    const matchesByDate: Record<string, Match[]> = {}
    matches.forEach(m => {
        const { dayStr } = formatDate(m.match_date)
        if (!matchesByDate[dayStr]) matchesByDate[dayStr] = []
        matchesByDate[dayStr].push(m)
    })

    const totalFinished = matches.filter(m => m.status === 'finished').length

    if (loading) return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
            <p className="text-gray-400">Cargando...</p>
        </main>
    )

    if (!isAdmin) return null

    return (
        <main className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                <NavMenu />
                <div>
                    <p className="font-bold text-gray-900">Panel Admin</p>
                    <p className="text-xs text-gray-400">{totalFinished} / 72 partidos terminados</p>
                </div>
                </div>
                <UserChip />
            </div>
            </header>
            {/* Pestañas */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-2xl mx-auto px-4 flex gap-1 pt-2">
                    <button
                        onClick={() => setActiveTab('partidos')}
                        className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${activeTab === 'partidos'
                            ? 'text-white'
                            : 'text-gray-500 hover:text-gray-900'
                            }`}
                        style={activeTab === 'partidos' ? { backgroundColor: '#006847' } : {}}
                    >
                        ⚽ Partidos
                    </button>
                    <button
                        onClick={() => { setActiveTab('usuarios'); loadUsers() }}
                        className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${activeTab === 'usuarios'
                            ? 'text-white'
                            : 'text-gray-500 hover:text-gray-900'
                            }`}
                        style={activeTab === 'usuarios' ? { backgroundColor: '#006847' } : {}}
                    >
                        👥 Usuarios
                    </button>
                </div>
            </div>
            {activeTab === 'partidos' && (
                <div className="max-w-2xl mx-auto px-4 py-6">

                    {/* Resumen */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                            <p className="text-2xl font-bold text-gray-900">{totalFinished}</p>
                            <p className="text-xs text-gray-400 mt-1">Terminados</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                            <p className="text-2xl font-bold text-gray-900">{72 - totalFinished}</p>
                            <p className="text-xs text-gray-400 mt-1">Pendientes</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                            <p className="text-2xl font-bold" style={{ color: '#006847' }}>
                                {Math.round((totalFinished / 72) * 100)}%
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Avance</p>
                        </div>
                    </div>

                    {/* Partidos por fecha */}
                    {Object.entries(matchesByDate).map(([dateStr, dayMatches]) => {
                        const todayMatches = dayMatches.some(m => isToday(m.match_date))
                        return (
                            <div key={dateStr} className="mb-6">
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <div className="h-px flex-1 bg-gray-200" />
                                    <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${todayMatches ? 'text-white' : 'text-gray-400'
                                        }`} style={todayMatches ? { backgroundColor: '#006847' } : {}}>
                                        {todayMatches ? '🔴 HOY — ' : '📅 '}{dateStr}
                                    </span>
                                    <div className="h-px flex-1 bg-gray-200" />
                                </div>

                                <div className="flex flex-col gap-3">
                                    {dayMatches.map(match => {
                                        const { timeStr } = formatDate(match.match_date)
                                        const isSaving = saving[match.id]
                                        const isSaved = saved[match.id]
                                        const score = scores[match.id] ?? { home: '', away: '' }
                                        const finished = match.status === 'finished'

                                        return (
                                            <div key={match.id}
                                                className={`bg-white rounded-2xl border shadow-sm p-4 ${finished ? 'border-green-100' : 'border-gray-100'
                                                    }`}>

                                                {/* Info */}
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                                                        style={{ backgroundColor: '#006847' }}>
                                                        Grupo {match.group_name}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        {finished && <span className="text-xs text-green-600 font-medium">✓ Terminado</span>}
                                                        <span className="text-xs text-gray-400">{timeStr} · {match.city}</span>
                                                    </div>
                                                </div>

                                                {/* Equipos y resultado */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex-1 flex flex-col items-center gap-1">
                                                        <span className="text-3xl">{match.home_team.flag}</span>
                                                        <span className="text-xs text-center font-medium text-gray-700 leading-tight">
                                                            {match.home_team.name}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number" min="0" max="20"
                                                            inputMode="numeric" pattern="[0-9]*"
                                                            value={score.home}
                                                            onChange={e => setScores(s => ({
                                                                ...s, [match.id]: { ...s[match.id], home: e.target.value }
                                                            }))}
                                                            className="w-12 h-12 text-center text-xl font-bold border-2 rounded-xl outline-none transition-colors text-gray-900"
                                                            style={{ borderColor: finished ? '#006847' : '#e5e7eb' }}
                                                        />
                                                        <span className="text-gray-300 font-bold text-lg">—</span>
                                                        <input
                                                            type="number" min="0" max="20"
                                                            inputMode="numeric" pattern="[0-9]*"
                                                            value={score.away}
                                                            onChange={e => setScores(s => ({
                                                                ...s, [match.id]: { ...s[match.id], away: e.target.value }
                                                            }))}
                                                            className="w-12 h-12 text-center text-xl font-bold border-2 rounded-xl outline-none transition-colors text-gray-900"
                                                            style={{ borderColor: finished ? '#006847' : '#e5e7eb' }}
                                                        />
                                                    </div>

                                                    <div className="flex-1 flex flex-col items-center gap-1">
                                                        <span className="text-3xl">{match.away_team.flag}</span>
                                                        <span className="text-xs text-center font-medium text-gray-700 leading-tight">
                                                            {match.away_team.name}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Botón guardar */}
                                                <div className="mt-4">
                                                    <button
                                                        onClick={() => handleSave(match)}
                                                        disabled={isSaving || score.home === '' || score.away === ''}
                                                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                                                        style={{ backgroundColor: isSaved ? '#16a34a' : '#006847' }}
                                                    >
                                                        {isSaving ? 'Guardando...' : isSaved ? '✓ Guardado' : finished ? 'Actualizar resultado' : 'Guardar resultado'}
                                                    </button>
                                                </div>

                                                {/* Botón deshacer resultado */}
                                                {match.status === 'finished' && (
                                                    <button
                                                        onClick={() => handleUndo(match.id)}
                                                        className="w-full py-2 rounded-xl text-sm font-medium text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 transition-colors mt-2"
                                                    >
                                                        ↩ Deshacer resultado
                                                    </button>
                                                )}

                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>)}
            {/* Pestaña usuarios */}
            {activeTab === 'usuarios' && (
                <div className="max-w-2xl mx-auto px-4 py-6">

                    {/* Total recaudado */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-500">Total a recaudar</p>
                            <p className="text-xs text-gray-400 mt-0.5">{users.length} usuarios · {users.reduce((s, u) => s + u.entries_count, 0)} quinielas</p>
                        </div>
                        <p className="text-3xl font-bold" style={{ color: '#006847' }}>
                            ${totalRecaudado}
                        </p>
                    </div>

                    {loadingUsers ? (
                        <p className="text-center text-gray-400 py-10">Cargando usuarios...</p>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="divide-y divide-gray-50">
                                {users.map(user => (
                                    <div key={user.id} className="px-5 py-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                {/* Avatar */}
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                                                        {user.avatar_url ? (
                                                            <img src={user.avatar_url} alt={user.display_name}
                                                                className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-lg">👤</span>
                                                        )}
                                                    </div>
                                                    <label className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer text-white text-xs"
                                                        style={{ backgroundColor: '#006847' }}>
                                                        +
                                                        <input type="file" accept="image/*" className="hidden"
                                                            onChange={e => {
                                                                const file = e.target.files?.[0]
                                                                if (file) handleAvatarUpload(user.id, file)
                                                            }} />
                                                    </label>
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">{user.display_name}</p>
                                                    <p className="text-xs text-gray-400">@{user.username}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-lg" style={{ color: '#006847' }}>
                                                    ${user.total_due}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {user.entries_count} {user.entries_count === 1 ? 'quiniela' : 'quinielas'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Barra de progreso de pronósticos */}
                                        <div className="mt-3">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs text-gray-400">Pronósticos capturados</span>
                                                <span className="text-xs text-gray-500 font-medium">
                                                    {user.total_predictions} / {user.entries_count * 72}
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all"
                                                    style={{
                                                        width: user.entries_count > 0
                                                            ? `${(user.total_predictions / (user.entries_count * 72)) * 100}%`
                                                            : '0%',
                                                        backgroundColor: user.total_predictions === user.entries_count * 72 && user.entries_count > 0
                                                            ? '#16a34a'
                                                            : '#006847'
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Estado */}
                                        <div className="mt-2">
                                            {user.entries_count === 0 ? (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-400">
                                                    Sin quinielas
                                                </span>
                                            ) : user.total_predictions === user.entries_count * 72 ? (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                                    ✓ Completo
                                                </span>
                                            ) : (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">
                                                    En progreso
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </main>
    )
}