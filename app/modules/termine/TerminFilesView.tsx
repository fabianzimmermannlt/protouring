'use client'

import { useEffect, useState } from 'react'
import { FolderOpen, ExternalLink, FileText } from 'lucide-react'
import TerminFileCard from './TerminFileCard'
import { getLinkedFiles, API_BASE, getAuthToken, getCurrentTenant, type LinkedFileGroup } from '@/lib/api-client'

export default function TerminFilesView({ terminId }: { terminId: number }) {
  const [groups, setGroups] = useState<LinkedFileGroup[]>([])
  useEffect(() => { getLinkedFiles(terminId).then(setGroups).catch(() => {}) }, [terminId])

  const open = (id: string, name: string) => {
    const token = getAuthToken()
    const tenant = getCurrentTenant() as { slug: string } | null
    window.open(`${API_BASE}/api/files/view/${id}/${encodeURIComponent(name || 'datei')}?token=${encodeURIComponent(token ?? '')}&slug=${encodeURIComponent(tenant?.slug ?? '')}`, '_blank')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <TerminFileCard terminId={String(terminId)} />

      {groups.length > 0 && (
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><FolderOpen className="w-3.5 h-3.5 inline mr-1" />Aus verknüpften Bereichen</span>
          </div>
          <div className="pt-card-body space-y-4">
            {groups.map((g, i) => (
              <div key={i}>
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{g.sourceType}: {g.sourceName}</div>
                <div className="space-y-1">
                  {g.files.map(f => (
                    <button key={f.id} onClick={() => open(f.id, f.originalName)} className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-[#2a2a2a] text-sm text-gray-200">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="flex-1 truncate">{f.originalName}</span>
                      {f.category && <span className="text-[10px] text-gray-500 shrink-0">{f.category}</span>}
                      <ExternalLink className="w-3 h-3 text-gray-500 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
