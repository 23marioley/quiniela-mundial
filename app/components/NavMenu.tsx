'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Link from 'next/link'
import LiveDrawer from './LiveDrawer'
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutos en ms
const SHOW_PREMIOS_LINK = true // cambiar a true cuando quieras verlo en el menú

export default function NavMenu() {
    const [open, setOpen] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    const router = useRouter()
    const pathname = usePathname()
    const supabase = createClient()
    const [profile, setProfile] = useState<{ display_name: string; avatar_url: string | null } | null>(null)

    useEffect(() => {
        async function checkAdmin() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', user.id)
                .single()
            if (profile?.is_admin) setIsAdmin(true)
        }
        checkAdmin()
    }, [])

    useEffect(() => {
        let timer: NodeJS.Timeout

        function resetTimer() {
            clearTimeout(timer)
            timer = setTimeout(async () => {
                await supabase.auth.signOut()
                router.push('/login')
            }, SESSION_TIMEOUT)
        }

        // Resetear timer con cualquier actividad del usuario
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
        events.forEach(e => window.addEventListener(e, resetTimer))
        resetTimer() // Iniciar timer al montar

        return () => {
            clearTimeout(timer)
            events.forEach(e => window.removeEventListener(e, resetTimer))
        }
    }, [])

    useEffect(() => {
        async function loadProfile() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data } = await supabase
                .from('profiles')
                .select('display_name, avatar_url')
                .eq('id', user.id)
                .single()
            if (data) setProfile(data)
        }
        loadProfile()
    }, [])

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const grupoActivo = new Date() >= new Date('2026-06-11T09:00:00Z')

    const links = [
        { href: '/mis-quinielas', label: 'Mis Quinielas', icon: '🏠', disabled: false },
        { href: '/grupos', label: 'Grupos', icon: '🌍', disabled: false },
        { href: '/rankings', label: 'Rankings', icon: '📊', disabled: false },
        // { href: '/grupo', label: 'Pronósticos del grupo', icon: '👁️', disabled: !grupoActivo },
        ...(isAdmin ? [{ href: '/admin', label: 'Panel Admin', icon: '⚙️', disabled: false }] : []),
        ...(SHOW_PREMIOS_LINK && isAdmin ? [{ href: '/premios', label: 'Premios', icon: '🏆', disabled: false }] : []),
        ]

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex flex-col gap-1.5 p-1"
                aria-label="Abrir menú"
            >
                <span className="block w-5 h-0.5 bg-gray-600 rounded" />
                <span className="block w-5 h-0.5 bg-gray-600 rounded" />
                <span className="block w-5 h-0.5 bg-gray-600 rounded" />
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
            )}

            <LiveDrawer />
            <div className={`fixed top-0 left-0 h-full w-72 bg-white shadow-xl z-50 transform transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'
                }`}>
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between"
                    style={{ background: 'linear-gradient(135deg, #006847, #2563eb)' }}>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚽</span>
                        <div>
                            <p className="font-bold text-white text-sm">Quiniela</p>
                            <p className="text-green-200 text-xs">Mundial 2026</p>
                        </div>
                    </div>
                    <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white text-xl">✕</button>
                </div>

                <nav className="px-4 py-6 flex flex-col gap-1">
                    {links.map(link => {
                        const active = pathname.startsWith(link.href)
                        return link.disabled ? (
                            <div
                                key={link.href}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 cursor-not-allowed opacity-50"
                            >
                                <span className="text-lg">{link.icon}</span>
                                {link.label}
                                <span className="ml-auto text-xs">🔒</span>
                            </div>
                        ) : (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${active ? 'text-white' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                style={active ? { backgroundColor: '#006847' } : {}}
                            >
                                <span className="text-lg">{link.icon}</span>
                                {link.label}
                            </Link>
                        )
                    })}
                </nav>

                <div className="absolute bottom-8 left-0 right-0 px-4">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <span className="text-lg">🚪</span>
                        Cerrar sesión
                    </button>
                </div>
            </div>
        </>
    )

}

export function UserChip() {
    const supabase = createClient()
    const [profile, setProfile] = useState<{ display_name: string; avatar_url: string | null } | null>(null)

    useEffect(() => {
        async function loadProfile() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data } = await supabase
                .from('profiles')
                .select('display_name, avatar_url')
                .eq('id', user.id)
                .single()
            if (data) setProfile(data)
        }
        loadProfile()
    }, [])

    if (!profile) return null

    return (
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 border-2"
                style={{ borderColor: '#006847' }}>
                {profile.avatar_url ? (
                    <img src={profile.avatar_url} className="w-full h-full object-cover" alt={profile.display_name} />
                ) : (
                    <span className="text-sm">👤</span>
                )}
            </div>
            <span className="text-sm font-semibold text-gray-700 hidden sm:block truncate max-w-24">
                {profile.display_name}
            </span>
        </div>
    )
}