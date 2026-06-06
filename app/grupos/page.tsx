'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import NavMenu, { UserChip } from '../components/NavMenu'

type TeamStanding = {
  team_id: number
  team_name: string
  team_flag: string
  pj: number
  g: number
  e: number
  p: number
  gf: number
  gc: number
  dg: number
  pts: number
}

type GroupData = {
  group_name: string
  teams: TeamStanding[]
}

export default function GruposPage() {
  const router = useRouter()
  const supabase = createClient()
  const [groups, setGroups] = useState<GroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<string>('A')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('group_standings')
      .select(`
        pj, g, e, p, gf, gc, dg, pts,
        teams!inner(id, name, flag, group_id),
        groups!inner(name)
      `)
      .order('pts', { ascending: false })

    if (data) {
      const groupMap: Record<string, TeamStanding[]> = {}

      data.forEach((row: any) => {
        const groupName = row.groups.name
        if (!groupMap[groupName]) groupMap[groupName] = []
        groupMap[groupName].push({
          team_id: row.teams.id,
          team_name: row.teams.name,
          team_flag: row.teams.flag,
          pj: row.pj,
          g: row.g,
          e: row.e,
          p: row.p,
          gf: row.gf,
          gc: row.gc,
          dg: row.dg,
          pts: row.pts,
        })
      })

      // Ordenar cada grupo por pts, luego DG, luego GF
      const formatted = Object.entries(groupMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, teams]) => ({
          group_name: name,
          teams: teams.sort((a, b) =>
            b.pts - a.pts || b.dg - a.dg || b.gf - a.gf
          )
        }))

      setGroups(formatted)
    }

    setLoading(false)
  }

  const groupNames = groups.map(g => g.group_name)
  const currentGroup = groups.find(g => g.group_name === selectedGroup)

  if (loading) return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Cargando grupos...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NavMenu />
            <div>
              <p className="font-bold text-gray-900">Grupos</p>
              <p className="text-xs text-gray-400">Fase de grupos Mundial 2026</p>
            </div>
          </div>
          <UserChip />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Selector de grupo */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Selecciona un grupo</p>
          <div className="grid grid-cols-6 gap-2">
            {groupNames.map(name => (
              <button
                key={name}
                onClick={() => setSelectedGroup(name)}
                className="py-2 rounded-xl text-sm font-bold transition-all"
                style={{
                  backgroundColor: selectedGroup === name ? '#006847' : '#f3f4f6',
                  color: selectedGroup === name ? 'white' : '#6b7280'
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla del grupo seleccionado */}
        {currentGroup && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #006847, #004d35)' }}>
              <h2 className="font-bold text-white text-lg">Grupo {currentGroup.group_name}</h2>
              <span className="text-green-200 text-sm">4 equipos</span>
            </div>

            {/* Header de la tabla */}
            <div className="grid grid-cols-12 px-4 py-2 bg-gray-50 border-b border-gray-100">
              <div className="col-span-4 text-xs font-semibold text-gray-400">Equipo</div>
              <div className="col-span-1 text-xs font-semibold text-gray-400 text-center">PJ</div>
              <div className="col-span-1 text-xs font-semibold text-gray-400 text-center">G</div>
              <div className="col-span-1 text-xs font-semibold text-gray-400 text-center">E</div>
              <div className="col-span-1 text-xs font-semibold text-gray-400 text-center">P</div>
              <div className="col-span-1 text-xs font-semibold text-gray-400 text-center">GF</div>
              <div className="col-span-1 text-xs font-semibold text-gray-400 text-center">GC</div>
              <div className="col-span-1 text-xs font-semibold text-gray-400 text-center">DG</div>
              <div className="col-span-1 text-xs font-semibold text-center" style={{ color: '#006847' }}>Pts</div>
            </div>

            {/* Filas de equipos */}
            <div className="divide-y divide-gray-50">
              {currentGroup.teams.map((team, index) => (
                <div key={team.team_id}
                  className={`grid grid-cols-12 px-4 py-3 items-center ${
                    index < 2 ? 'bg-green-50/30' : ''
                  }`}>
                  <div className="col-span-4 flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-4">{index + 1}</span>
                    <span className="text-lg">{team.team_flag}</span>
                    <span className="text-xs font-medium text-gray-700 truncate">{team.team_name}</span>
                  </div>
                  <div className="col-span-1 text-xs text-gray-500 text-center">{team.pj}</div>
                  <div className="col-span-1 text-xs text-gray-500 text-center">{team.g}</div>
                  <div className="col-span-1 text-xs text-gray-500 text-center">{team.e}</div>
                  <div className="col-span-1 text-xs text-gray-500 text-center">{team.p}</div>
                  <div className="col-span-1 text-xs text-gray-500 text-center">{team.gf}</div>
                  <div className="col-span-1 text-xs text-gray-500 text-center">{team.gc}</div>
                  <div className="col-span-1 text-xs text-gray-500 text-center">
                    {team.dg > 0 ? `+${team.dg}` : team.dg}
                  </div>
                  <div className="col-span-1 text-center">
                    <span className="text-sm font-black" style={{ color: '#006847' }}>{team.pts}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Leyenda */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
                <span className="text-xs text-gray-400">Clasifican a octavos</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}