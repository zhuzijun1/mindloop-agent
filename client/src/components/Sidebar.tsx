import type { Session } from '../types'

interface SidebarProps {
  sessions: Session[]
  activeId: string | null
  onSelect: (session: Session) => void
  onNew: () => void
  onDelete: (id: string) => void
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function Sidebar({ sessions, activeId, onSelect, onNew, onDelete }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button className="new-session" onClick={onNew}>
        ＋ 新建会话
      </button>
      <div className="session-list">
        {sessions.length === 0 && <div className="session-empty">还没有会话</div>}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-item${s.id === activeId ? ' active' : ''}`}
            onClick={() => onSelect(s)}
          >
            <div className="session-info">
              <div className="session-title">{s.title}</div>
              <div className="session-meta">
                {s.messages.length} 条消息 · {formatTime(s.updatedAt)}
              </div>
            </div>
            <button
              className="session-delete"
              title="删除会话"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(s.id)
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="sidebar-footer">ReAct · SSE · 本地工具</div>
    </aside>
  )
}
