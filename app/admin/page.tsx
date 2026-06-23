// admin/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Link from 'next/link'
import NavMenu, { UserChip } from '../components/NavMenu'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
const [activeTab, setActiveTab] = useState<'partidos' | 'usuarios' | 'pdf' | 'sesiones'>('partidos')
    const SHOW_SESIONES_TAB = true // cambiar a true para reactivar
    const SHOW_PDF_TAB = false // cambiar a true para reactivar
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [totalRecaudado, setTotalRecaudado] = useState(0)
const [generatingPDF, setGeneratingPDF] = useState(false)
    const [sessions, setSessions] = useState<any[]>([])
    const [loadingSessions, setLoadingSessions] = useState(false)
    const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split('T')[0])

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
            .order('match_number', { ascending: true })

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

async function loadSessions(date: string) {
        setLoadingSessions(true)
        // Monterrey = UTC-6, entonces el día local empieza a las 06:00 UTC
        const from = `${date}T06:00:00.000Z`
        // El fin del día MTY es el día siguiente a las 05:59:59 UTC
        const [y, m, d] = date.split('-').map(Number)
        const nextDay = new Date(Date.UTC(y, m - 1, d + 1))
        const to = `${nextDay.toISOString().split('T')[0]}T05:59:59.999Z`

        const { data } = await supabase
            .from('login_sessions')
            .select('*')
            .gte('created_at', from)
            .lte('created_at', to)
            .order('created_at', { ascending: false })

        setSessions(data ?? [])
        setLoadingSessions(false)
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
            total_due: (entriesByUser[p.id]?.count ?? 0) * 350,
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
        // Validar tamaño máximo 2MB
        if (file.size > 2 * 1024 * 1024) {
            alert('La foto no puede pesar más de 2MB')
            return
        }

        // Forzar extensión jpg para compatibilidad
        const fileName = `${userId}.jpg`

        // Convertir a blob con compresión si es necesario
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, {
                upsert: true,
                contentType: 'image/jpeg'
            })

        if (uploadError) {
            alert('Error al subir: ' + uploadError.message)
            return
        }

        const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName)

        // Agregar timestamp para evitar caché
        const urlWithCache = urlData.publicUrl + '?t=' + Date.now()

        await supabase
            .from('profiles')
            .update({ avatar_url: urlWithCache })
            .eq('id', userId)

        setUsers(prev => prev.map(u =>
            u.id === userId ? { ...u, avatar_url: urlWithCache } : u
        ))
    }

    async function generatePDF() {
        setGeneratingPDF(true)

        // Cargar todos los partidos
        const { data: matchesData } = await supabase
            .from('matches')
            .select(`
      id, match_number, match_date, city,
      groups!inner(name),
      home_team:teams!matches_home_team_id_fkey(id, name, flag),
      away_team:teams!matches_away_team_id_fkey(id, name, flag)
    `)
            .order('match_number', { ascending: true })

        // Cargar todas las quinielas
        const { data: entriesRaw } = await supabase
            .from('entries')
            .select('id, name, user_id')
            .order('user_id')

        // Cargar perfiles
        const userIds = [...new Set(entriesRaw?.map((e: any) => e.user_id) ?? [])]
        const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds)

        const profilesMap: Record<string, string> = {}
        profilesData?.forEach((p: any) => { profilesMap[p.id] = p.display_name })

        const entriesData = entriesRaw?.map((e: any) => ({
            id: e.id,
            name: e.name,
            user_id: e.user_id,
            display_name: profilesMap[e.user_id] ?? 'Usuario'
        }))

        // Cargar todos los pronósticos
        // const { data: predsData } = await supabase
        //     .from('predictions')
        //     .select('entry_id, match_id, predicted_home, predicted_away')
        //     .limit(2000)

        // Cargar todos los pronósticos en múltiples páginas
        let predsData: any[] = []
        let from = 0
        const pageSize = 500

        while (true) {
            const { data: page } = await supabase
                .from('predictions')
                .select('entry_id, match_id, predicted_home, predicted_away')
                .range(from, from + pageSize - 1)

            if (!page || page.length === 0) break
            predsData = [...predsData, ...page]
            if (page.length < pageSize) break
            from += pageSize
        }

        if (!matchesData || !entriesData || !predsData) {
            setGeneratingPDF(false)
            return
        }

        // Mapear pronósticos
        const predsMap: Record<string, string> = {}
        predsData.forEach((p: any) => {
            predsMap[`${p.entry_id}-${p.match_id}`] = `${p.predicted_home ?? '?'}-${p.predicted_away ?? '?'}`
        })

        // Formatear entradas
        const entries = entriesData.map((e: any) => ({
            id: e.id,
            label: entriesData.filter((x: any) => x.user_id === e.user_id).length > 1
                ? `${e.display_name} (${e.name})`
                : e.display_name
        }))

        console.log('Total predicciones cargadas:', predsData.length)
        console.log('Entry IDs:', entries.map(e => e.id))
        console.log('Prediccion entry 48 match 1:', predsMap['48-1'])
        console.log('Prediccion entry 49 match 1:', predsMap['49-1'])
        console.log('Muestra predsData entry 48:', predsData.filter((p: any) => p.entry_id === 48).slice(0, 3))

        // Crear PDF
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

        // Título
        doc.setFontSize(18)
        doc.setTextColor(0, 104, 71)
        doc.text('Quiniela Mundial 2026', 148, 15, { align: 'center' })

        doc.setFontSize(10)
        doc.setTextColor(100, 100, 100)
        doc.text(`Generado el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`, 148, 22, { align: 'center' })
        doc.text(`${entries.length} participantes · ${matchesData.length} partidos`, 148, 28, { align: 'center' })

        // Tabla
        const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

        const tableData = matchesData.map((m: any) => {
            const d = new Date(m.match_date)
            const mty = new Date(d.getTime() - 6 * 60 * 60 * 1000)
            const dateStr = `${mty.getUTCDate()} ${MONTHS[mty.getUTCMonth()]}`
            const hours = mty.getUTCHours()
            const minutes = mty.getUTCMinutes().toString().padStart(2, '0')
            const ampm = hours >= 12 ? 'pm' : 'am'
            const h = hours % 12 || 12
            const timeStr = `${h}:${minutes}${ampm}`

            return [
                `${m.match_number}`,
                `Gr. ${m.groups.name}`,
                `${m.home_team.name} vs ${m.away_team.name}`,
                `${dateStr} ${timeStr}`,
                ...entries.map(e => predsMap[`${e.id}-${m.id}`] ?? '-')
            ]
        })

        autoTable(doc, {
            startY: 33,
            head: [['#', 'Grupo', 'Partido', 'Fecha', ...entries.map(e => e.label)]],
            body: tableData,
            styles: { fontSize: 6, cellPadding: 1.5 },
            headStyles: {
                fillColor: [0, 104, 71],
                textColor: 255,
                fontSize: 6,
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 8 },
                1: { halign: 'center', cellWidth: 12 },
                2: { cellWidth: 35 },
                3: { halign: 'center', cellWidth: 20 },
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index >= 4) {
                    data.cell.styles.halign = 'center'
                }
            }
        })

        doc.save('quiniela-mundial-2026.pdf')
        setGeneratingPDF(false)
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
                    {SHOW_SESIONES_TAB && (
                    <button
                        onClick={() => { setActiveTab('sesiones'); loadSessions(sessionDate) }}
                        className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${activeTab === 'sesiones' ? 'text-white' : 'text-gray-500 hover:text-gray-900'}`}
                        style={activeTab === 'sesiones' ? { backgroundColor: '#006847' } : {}}
                    >
                        👁️ Sesiones
                    </button>
                    )}
                    {SHOW_PDF_TAB && (
                    <button
                        onClick={() => setActiveTab('pdf')}
                        className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${activeTab === 'pdf' ? 'text-white' : 'text-gray-500 hover:text-gray-900'
                            }`}
                        style={activeTab === 'pdf' ? { backgroundColor: '#006847' } : {}}
                    >
                        📄 Generar PDF
                    </button>
                    )}
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
{activeTab === 'sesiones' && (
                <div className="max-w-2xl mx-auto px-4 py-6">
                    {/* Filtro por fecha */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex items-center gap-3">
                        <span className="text-sm text-gray-500 font-medium">📅 Fecha:</span>
                        <input
                            type="date"
                            value={sessionDate}
                            onChange={e => { setSessionDate(e.target.value); loadSessions(e.target.value) }}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none"
                        />
                        <span className="text-xs text-gray-400 ml-auto">{sessions.length} sesiones</span>
                    </div>

                    {loadingSessions ? (
                        <p className="text-center text-gray-400 py-10">Cargando sesiones...</p>
                    ) : sessions.length === 0 ? (
                        <p className="text-center text-gray-400 py-10">Sin sesiones ese día</p>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="divide-y divide-gray-50">
                                {sessions.map((s: any) => {
                                    const mty = new Date(new Date(s.created_at).getTime() - 6 * 60 * 60 * 1000)
                                    const hours = mty.getUTCHours()
                                    const minutes = mty.getUTCMinutes().toString().padStart(2, '0')
                                    const ampm = hours >= 12 ? 'pm' : 'am'
                                    const h = hours % 12 || 12
                                    return (
                                        <div key={s.id} className="px-5 py-4 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                {s.avatar_url ? (
                                                    <img src={s.avatar_url} className="w-full h-full object-cover" alt={s.display_name} />
                                                ) : (
                                                    <span className="text-base">👤</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 text-sm">{s.display_name}</p>
                                                <p className="text-xs text-gray-400">@{s.username} · {s.device_type} · {s.ip}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm font-bold text-gray-700">{h}:{minutes} {ampm}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'pdf' && (
                                <div className="max-w-2xl mx-auto px-4 py-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                        <div className="text-5xl mb-4">📄</div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Generar PDF de transparencia</h2>
                        <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                            Genera un PDF con todos los pronósticos de todos los participantes para compartirlo y garantizar transparencia.
                        </p>

                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6 text-left">
                            <p className="text-amber-700 text-sm font-semibold mb-1">⚠️ Recomendación</p>
                            <p className="text-amber-600 text-sm">
                                Genera y comparte este PDF cuando falten menos de 10 horas para el inicio del torneo, cuando ya nadie pueda modificar sus pronósticos.
                            </p>
                        </div>

                        <button
                            onClick={generatePDF}
                            disabled={generatingPDF}
                            className="w-full text-white font-bold py-4 rounded-2xl transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #006847, #004d35)' }}
                        >
                            {generatingPDF ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Generando PDF...
                                </>
                            ) : (
                                '📄 Descargar PDF de pronósticos'
                            )}
                        </button>
                    </div>
                </div>
            )}
        </main>
    )
}