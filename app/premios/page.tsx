//premios/page.tsx

'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import NavMenu, { UserChip } from '../components/NavMenu'
import { Poppins } from 'next/font/google'

const PUBLICO = false // cambiar a true cuando termine el torneo

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })

type Award = {
    id: string
    emoji: string
    title: string
    subtitle?: string
    name?: string
    avatar?: string | null
    type?: 'default' | 'intro' | 'wamessage'
    waMessage?: string
    waImage?: string
    prize?: number
    winners?: { display_name: string; avatar_url?: string }[]
}

export default function PremiosPage() {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [step, setStep] = useState(0)
    const [visible, setVisible] = useState(false)
    const [awards, setAwards] = useState<Award[]>([])
    const touchStartX = useRef<number | null>(null)

    useEffect(() => { loadData() }, [])

    useEffect(() => {
        setVisible(false)
        const t = setTimeout(() => setVisible(true), 50)
        return () => clearTimeout(t)
    }, [step, loading])

    async function fetchAllPaginated(table: string, select: string) {
        let all: any[] = []
        let from = 0
        const pageSize = 500
        while (true) {
            const { data } = await supabase.from(table).select(select).range(from, from + pageSize - 1)
            if (!data || data.length === 0) break
            all = [...all, ...data]
            if (data.length < pageSize) break
            from += pageSize
        }
        return all
    }

    function longestStreak(arr: { points: number }[], cond: (p: number) => boolean) {
        let best = 0, current = 0
        arr.forEach(p => {
            if (cond(p.points)) { current++; best = Math.max(best, current) }
            else current = 0
        })
        return best
    }

    async function loadData() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const { data: profile } = await supabase
            .from('profiles').select('is_admin').eq('id', user.id).single()

        const { count: upcoming } = await supabase
            .from('matches')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'upcoming')
        const torneoTerminado = upcoming === 0

        if (!profile?.is_admin && !PUBLICO && !torneoTerminado) { router.push('/mis-quinielas'); return }

        const { data: matchesData } = await supabase
            .from('matches')
            .select(`id, match_number, home_score, away_score,
                home_team:teams!matches_home_team_id_fkey(name, flag),
                away_team:teams!matches_away_team_id_fkey(name, flag)`)
            .eq('status', 'finished')
            .order('match_number', { ascending: true })

        const matches = matchesData ?? []
        const matchNumberMap: Record<number, number> = {}
        matches.forEach((m: any) => { matchNumberMap[m.id] = m.match_number })

        const predictions = await fetchAllPaginated(
            'predictions',
            'entry_id, match_id, predicted_home, predicted_away, points_earned'
        )
        const rankingHistory = await fetchAllPaginated(
            'ranking_history',
            'match_id, entry_id, position'
        )

        const { data: rankingsData } = await supabase
            .from('rankings')
            .select('entry_id, user_id, display_name, avatar_url, total_points, exact_scores, correct_results, position')

        const rankings = (rankingsData ?? []).map((r: any) => ({ ...r, position: Number(r.position) }))
        const rankingByEntry: Record<number, any> = {}
        rankings.forEach((r: any) => { rankingByEntry[r.entry_id] = r })

        const { count: entriesCount } = await supabase
            .from('entries')
            .select('id', { count: 'exact', head: true })

        const prize = (entriesCount ?? 0) * 350

        const list: Award[] = []

        // Intro
        list.push({
            id: 'intro', emoji: '🏁', type: 'intro',
            title: 'El torneo ha terminado',
            subtitle: 'Pero antes de los premios, vamos con algunas frases que quedarán para la historia...',
        })

        // Mensajes de WhatsApp (hardcodeados — edita aquí)
        const waMessages: { id: string; username: string; message?: string; image?: string }[] = [
            {
                id: 'wa_nopal',
                username: 'nopal',
                message: 'No se me achicopalen que todavía faltan 71 partidos 😅'
            },
            {
                id: 'wa_aglae',
                username: 'Aglae',
                message: 'Los últimos serán los primeros 🤣😢'
            },
            {
                id: 'wa_elena',
                username: 'elena_ley',
                message: 'Pasu mecha marimar!!!! Que siga sumando!!! 😅'
            },
            {
                id: 'wa_alex',
                username: 'AlexVega7',
                message: 'Así que esto se siente ganar 3 puntos?'
            },
            {
                id: 'wa_kalin2',
                username: 'Kalin10',
                message: 'A poco así de fresco se siente estar aqui cerquita de la Cima?'
            },
            {
                id: 'wa_jenny2',
                username: 'Jennifer_Ley',
                message: 'Ya que se acabe la humillación jajaja, digo el mundial 😂'
            },
            {
                id: 'wa_danny',
                username: 'dannielaley',
                message: 'Vamos Cabo Verde!'
            },
            {
                id: 'wa_brandon',
                username: 'BrandonLey17',
                message: 'Danny ya me alcanzo en puntos\nme retiro'
            },
            {
                id: 'wa_danny2',
                username: 'dannielaley',
                message: 'Ya me brincó Jenny\nMe retiro'
            }, 
            {
                id: 'wa_patty',
                username: 'PATTY',
                message: 'Soy medio bruja'
            },
            {
                id: 'wa_pedro',
                username: 'Pedroley',
                message: 'Cacheton pero contento. Viva México Ajua.'
            },
            {
                id: 'wa_kalin',
                username: 'Kalin10',
                message: 'Ya terminalo arbitro ingrato!!!!!!'
            },
            {
                id: 'wa_alex',
                username: 'AlexVega7',
                message: 'Hasta que pierda Alex fue lo que leí ahi en el letrero de la FIFA'
            },
            {
                id: 'wa_nopal2',
                username: 'nopal',
                message: 'The game is not over until it is.'
            },
            {
                id: 'wa_mario',
                username: 'MARIO_LEY_D',
                message: 'Císcale, císcale, diablo panzón 🤣'
            },
            {
                id: 'wa_jenny',
                username: 'Jennifer_Ley',
                message: 'Y esta rosa?'
            },
            //  {
            //     id: 'wa_fatima',
            //     username: 'FaKatherine',
            //     message: 'Ya voy a tener Fe como Jeny y saldré de ese último lugar 😎\nAlgún día 🤪'
            // },
            
            {
                id: 'wa_pepinillo',
                username: 'Pepinillo_Quiroz',
                image: '/sticker-bb.jpeg'
            },  
        ]

        // Buscar avatares de los usuarios de WA
        const waUsernames = waMessages.map(m => m.username)
        const { data: waProfiles } = await supabase
            .from('profiles')
            .select('display_name, username, avatar_url')
            .or(waUsernames.map(u => `username.ilike.${u},display_name.ilike.${u}`).join(','))

        const waAvatarMap: Record<string, string | null> = {}
        waProfiles?.forEach((p: any) => {
            waAvatarMap[p.username?.toLowerCase()] = p.avatar_url
            waAvatarMap[p.display_name?.toLowerCase()] = p.avatar_url
        })

        waMessages.forEach(m => {
            const avatar = waAvatarMap[m.username.toLowerCase()] ?? null
            list.push({
                id: `wa_${m.id}`,
                type: 'wamessage',
                emoji: '💬',
                title: m.username,
                waMessage: m.message,
                waImage: m.image,
                name: m.username,
                avatar,
            })
        })

        // Transición
        list.push({
            id: 'transicion', emoji: '🏅', type: 'intro',
            title: '¡Ahora sí!',
            subtitle: 'Vamos con los galardonados de la\nQuiniela Mundial 2026',
        })

        // 1. Resultado más loco que sí se cumplió
        let loco: any = null
        predictions.filter((p: any) => p.points_earned === 3).forEach((p: any) => {
            const m: any = matches.find((mm: any) => mm.id === p.match_id)
            if (!m || m.home_score === null || m.away_score === null) return
            const total = m.home_score + m.away_score
            const diff = Math.abs(m.home_score - m.away_score)
            if (!loco || total > loco.total || (total === loco.total && diff > loco.diff)) {
                loco = { entry_id: p.entry_id, total, diff, home: m.home_score, away: m.away_score, match_number: m.match_number, home_team: m.home_team, away_team: m.away_team }
            }
        })
        if (loco) {
            const r = rankingByEntry[loco.entry_id]
            list.push({
                id: 'loco', emoji: '🔮', title: '"🤪 Me llamaron loco 🤪"',
                subtitle: `Le atinaste exacto al ${loco.home}-${loco.away} en el ${loco.home_team.name} vs ${loco.away_team.name}, el resultado más difícil de pronosticar\nEstás loco!`,
                name: r?.display_name, avatar: r?.avatar_url,
            })
        }

        // Posiciones por entry ordenadas por jornada
        const posByEntry: Record<number, { match_number: number; position: number }[]> = {}
        rankingHistory.forEach((h: any) => {
            if (!posByEntry[h.entry_id]) posByEntry[h.entry_id] = []
            posByEntry[h.entry_id].push({ match_number: matchNumberMap[h.match_id] ?? 0, position: h.position })
        })
        Object.values(posByEntry).forEach(arr => arr.sort((a, b) => a.match_number - b.match_number))

        // 2. Remontada / 3. Anti-remontada (peor posición histórica vs posición final)
        let bestClimb: any = null
        let worstFall: any = null
        Object.entries(posByEntry).forEach(([entryId, arr]) => {
            if (arr.length < 2) return
            const end = arr[arr.length - 1].position
            const worstPos = Math.max(...arr.map(p => p.position))  // número más alto = peor lugar
            const bestPos = Math.min(...arr.map(p => p.position))   // número más bajo = mejor lugar
            const climbDelta = worstPos - end   // cuánto subió desde su peor momento
            const fallDelta = end - bestPos     // cuánto cayó desde su mejor momento
            if (!bestClimb || climbDelta > bestClimb.delta) bestClimb = { entry_id: Number(entryId), delta: climbDelta, worst: worstPos, end }
            if (!worstFall || fallDelta > worstFall.delta) worstFall = { entry_id: Number(entryId), delta: fallDelta, best: bestPos, end }
        })
        if (bestClimb && bestClimb.delta > 0) {
            const r = rankingByEntry[bestClimb.entry_id]
            list.push({
                id: 'remontada', emoji: '📈', title: '📈 Remontada Épica 📈',
                subtitle: `En tu peor momento estuviste en el #${bestClimb.worst} y terminaste en el #${bestClimb.end} — subiste ${bestClimb.delta} posiciones\nEjemplo de superación!`,
                name: r?.display_name, avatar: r?.avatar_url,
            })
        }
        if (worstFall && worstFall.delta > 0) {
            const r = rankingByEntry[worstFall.entry_id]
            list.push({
                id: 'caida', emoji: '📉', title: '📉 La Anti Remontada 📉',
                subtitle: `En tu mejor momento estuviste en el #${worstFall.best} y terminaste en el #${worstFall.end} — caíste ${worstFall.delta} posiciones\nLa campeona vigente tuvo que ceder el trono 😢`,
                name: r?.display_name, avatar: r?.avatar_url,
            })
        }

        // 4. 👁️ Ojo Clínico 👁️
        const topCorrect = [...rankings].sort((a, b) => b.correct_results - a.correct_results)[0]
        if (topCorrect) {
            list.push({
                id: 'correctos', emoji: '✅', title: '👁️ Ojo Clínico 👁️',
                subtitle: `Fuiste el participante con más resultados correctos atinados con: ${topCorrect.correct_results}\nQue genio!`,
                name: topCorrect.display_name, avatar: topCorrect.avatar_url,
            })
        }

        // 5. 🔮 Profeta 🔮
        const topExact = [...rankings].sort((a, b) => b.exact_scores - a.exact_scores)[0]
        if (topExact) {
            list.push({
                id: 'exactos', emoji: '🎯', title: '🔮 El Profeta 🔮',
                subtitle: `Fuiste el participante con más marcadores exactos atinados con: ${topExact.exact_scores}\nLe sabes mucho!`,
                name: topExact.display_name, avatar: topExact.avatar_url,
            })
        }

        // 6. Caballo Negro (top 3 actual con peor arranque)
        // let caballoNegro: any = null
        // rankings.filter((r: any) => r.position <= 3).forEach((r: any) => {
        //     const arr = posByEntry[r.entry_id]
        //     if (!arr || arr.length === 0) return
        //     const start = arr[0].position
        //     const end = arr[arr.length - 1].position
        //     if (!caballoNegro || start > caballoNegro.start) caballoNegro = { entry_id: r.entry_id, start, end }
        // })
        // if (caballoNegro) {
        //     const r = rankingByEntry[caballoNegro.entry_id]
        //     list.push({
        //         id: 'caballo', emoji: '🐎', title: 'Caballo Negro',
        //         subtitle: `Arrancaste en el #${caballoNegro.start} y terminaste en el #${caballoNegro.end}`,
        //         name: r?.display_name, avatar: r?.avatar_url,
        //     })
        // }

        // Streaks por jornada
        const predsByEntry: Record<number, { match_number: number; points: number }[]> = {}
        predictions.forEach((p: any) => {
            if (p.points_earned === null) return
            const mn = matchNumberMap[p.match_id]
            if (!mn) return
            if (!predsByEntry[p.entry_id]) predsByEntry[p.entry_id] = []
            predsByEntry[p.entry_id].push({ match_number: mn, points: p.points_earned })
        })
        Object.values(predsByEntry).forEach(arr => arr.sort((a, b) => a.match_number - b.match_number))

        // 7. 🔥 En Llamas 🔥
        let racha: any = null
        Object.entries(predsByEntry).forEach(([entryId, arr]) => {
            const streak = longestStreak(arr, p => p > 0)
            if (!racha || streak > racha.streak) racha = { entry_id: Number(entryId), streak }
        })
        if (racha && racha.streak > 0) {
            const r = rankingByEntry[racha.entry_id]
            list.push({
                id: 'racha', emoji: '🔥', title: '🔥 En Llamas 🔥',
                subtitle: `Tuviste la racha más larga de partidos sumando al menos 1 punto: ${racha.streak} partidos consecutivos\nEnrachado!`,
                name: r?.display_name, avatar: r?.avatar_url,
            })
        }

        // 8. ⚡ Imparable ⚡
        let vidente: any = null
        Object.entries(predsByEntry).forEach(([entryId, arr]) => {
            const streak = longestStreak(arr, p => p === 3)
            if (!vidente || streak > vidente.streak) vidente = { entry_id: Number(entryId), streak }
        })
        if (vidente && vidente.streak > 0) {
            // Buscar todos los que tienen la misma racha máxima
            const videnteGanadores = Object.entries(predsByEntry)
                .filter(([, arr]) => longestStreak(arr, p => p === 3) === vidente.streak)
                .map(([entryId]) => rankingByEntry[Number(entryId)])
                .filter(Boolean)
            list.push({
                id: 'vidente', emoji: '⚡', title: '⚡ Imparable ⚡',
                subtitle: `Tuviste la racha más larga de partidos sumando 3 puntos: ${vidente.streak} partidos consecutivos`,
                winners: videnteGanadores,
            })
        }

        // 9. Constancia (más jornadas en 1er lugar)
        const firstPlaceCount: Record<number, number> = {}
        rankingHistory.forEach((h: any) => {
            if (h.position === 1) firstPlaceCount[h.entry_id] = (firstPlaceCount[h.entry_id] ?? 0) + 1
        })
        let constancia: any = null
        Object.entries(firstPlaceCount).forEach(([entryId, count]) => {
            if (!constancia || count > constancia.count) constancia = { entry_id: Number(entryId), count }
        })
        if (constancia) {
            const r = rankingByEntry[constancia.entry_id]
            list.push({
                id: 'constancia', emoji: '👑', title: '⭐ Líder ⭐',
                subtitle: `Mayor cantidad de partidos en primer lugar, con: ${constancia.count}\nNadie se te compara!`,
                name: r?.display_name, avatar: r?.avatar_url,
            })
        }

        // 10. Suspenso
        list.push({ id: 'suspenso', emoji: '🥁', title: '🏆🏆🏆\nY por último\nnuestro CAMPEÓN...' })

        // 11. Ganador
        const winner = rankings.find((r: any) => r.position === 1)
        if (winner) {
            list.push({
                id: 'ganador', emoji: '🏆', title: '👑👑 CAMPEÓN 👑👑',
                subtitle: `¡Empieza a cobrar!`,
                prize,
                name: winner.display_name, avatar: winner.avatar_url,
            })
        }

        // 12. Cierre
        list.push({
            id: 'gracias',
            emoji: '👋',
            title: 'Gracias por participar!',
            winners: [
                ...rankings.filter((r: any) => r.display_name !== 'marioleyt'),
                ...rankings.filter((r: any) => r.display_name === 'marioleyt'),
            ].map((r: any) => ({ display_name: r.display_name, avatar_url: r.avatar_url })),
        })
        list.push({ id: 'cierre', emoji: '👋', title: 'Nos vemos en el 2030!!!\n🇪🇸 🇵🇹 🇲🇦' })

        setAwards(list)
        setLoading(false)
    }

    if (loading) return (
        <main className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #001a12, #003322)' }}>
            <p className="text-white/60">Preparando la ceremonia...</p>
        </main>
    )

    const award = awards[step]
    const isFirst = step === 0
    const isLast = step === awards.length - 1

    return (
<main className={`h-dvh flex flex-col ${poppins.className}`} style={{ background: 'linear-gradient(135deg, #006847, #ffffff, #dc2626, #1e3a8a)' }}>            <header className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <NavMenu />
                    <p className="font-bold text-white">🏆 Premios Quiniela 2026</p>
                </div>
                <UserChip />
            </header>

            <div
                className="flex-1 flex items-center justify-center px-4"
                onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
                onTouchEnd={e => {
                    if (touchStartX.current === null) return
                    const diff = touchStartX.current - e.changedTouches[0].clientX
                    if (diff > 50 && step < awards.length - 1) setStep(s => s + 1)
                    if (diff < -50 && step > 0) setStep(s => s - 1)
                    touchStartX.current = null
                }}
            >
                <div
                    key={award.id}
                    className={`max-w-sm w-full bg-white rounded-3xl shadow-2xl p-8 text-center transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-4'
                        }`}
                >
                    {award.type === 'wamessage' ? (
                        <div className="flex flex-col items-center gap-4">
                            {/* Bubble */}
                            <div className="relative rounded-2xl rounded-tl-none px-5 py-4 text-left w-full"
                                style={{ backgroundColor: '#d9fdd3'}}>
                                <p className="text-sm font-bold text-[#075e54] mb-1">{award.name}</p>
                                {award.waImage
                                    ? <img src={award.waImage} className="rounded-xl" style={{ width: '125px', margin: '0 auto' }} />
                                    : <p className="text-gray-800 text-base leading-snug">{award.waMessage}</p>
                                }
                                <div className="absolute -top-2 left-0 w-0 h-0"
                                    style={{ borderRight: '10px solid #6abf69', borderTop: '10px solid transparent' }} />
                                {/* <div className="absolute -top-1.5 left-0.5 w-0 h-0"
                                    style={{ borderRight: '9px solid #d9fdd3', borderTop: '9px solid transparent' }} /> */}
                            </div>
                            {/* Avatar */}
                            <div className="w-24 h-24 overflow-hidden bg-gray-100 rounded-3xl flex items-center justify-center">
                                {award.avatar ? (
                                    <img src={award.avatar} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-4xl">👤</span>
                                )}
                            </div>
                            <p className="font-bold text-lg" style={{ color: '#006847' }}>{award.name}</p>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl font-extrabold whitespace-pre-line mb-2" style={{ color: '#b8860b' }}>{award.title}</h2>

                            {award.name && (
                                <div className="w-32 h-32 overflow-hidden bg-gray-100 mx-auto mb-4 rounded-3xl flex items-center justify-center">
                                    {award.avatar ? (
                                        <img src={award.avatar} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-5xl">👤</span>
                                    )}
                                </div>
                            )}

                            {award.winners && award.winners.length > 0 && (
                                <div className="flex flex-wrap justify-center gap-3 mb-3">
                                    {award.winners.map((w, i) => (
                                        <div key={i} className="flex flex-col items-center gap-1">
                                            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center">
                                                {w.avatar_url
                                                    ? <img src={w.avatar_url} className="w-full h-full object-cover" />
                                                    : <span className="text-2xl">👤</span>}
                                            </div>
                                            <p className="text-xs font-semibold text-gray-700">{w.display_name}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!award.winners && award.name && <p className="font-bold text-xl mb-1" style={{ color: '#006847' }}>{award.name}</p>}
                            {award.prize && (
                                <>
                                    <p className="font-extrabold text-lg mt-2" style={{ color: '#b8860b' }}>¡Felicidades!</p>
                                    <p className="text-gray-600 text-sm mt-1 mb-2">Has ganado la Quiniela Mundial 2026,<br/>tu premio es de:</p>
                                    <p className="text-3xl font-extrabold my-2" style={{ color: '#b8860b' }}>
                                        🏆 ${award.prize.toLocaleString('es-MX')}
                                    </p>
                                </>
                            )}
                            {award.subtitle && <p className="text-gray-600 text-sm whitespace-pre-line">{award.subtitle}</p>}
                        </>
                    )}
                </div>
            </div>

            <div className="px-4 py-2 flex items-center justify-between max-w-sm mx-auto w-full">
                <button
                    onClick={() => setStep(s => Math.max(0, s - 1))}
                    disabled={isFirst}
                    className="text-white/60 disabled:opacity-20 text-2xl font-bold w-10 text-left"
                >
                    ←
                </button>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: step === 0 ? '#ffd700' : 'rgba(255,255,255,0.3)' }} />
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: step > 0 && step < awards.length - 1 ? '#ffd700' : 'rgba(255,255,255,0.3)' }} />
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: step === awards.length - 1 ? '#ffd700' : 'rgba(255,255,255,0.3)' }} />
                </div>
                {isLast ? (
                    <button onClick={() => router.push('/rankings')} className="text-2xl font-bold w-10 text-right" style={{ color: '#ffd700' }}>
                        ✕
                    </button>
                ) : (
                    <button onClick={() => setStep(s => s + 1)} className="text-2xl font-bold w-10 text-right" style={{ color: '#ffd700' }}>
                        →
                    </button>
                )}
            </div>
        </main>
    )
}