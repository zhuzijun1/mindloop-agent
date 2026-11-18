import { AgentTrace } from './AgentTrace'
import type { UIMessage } from '../types'

export function MessageBubble({ msg }: { msg: UIMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`row${isUser ? ' right' : ''}`}>
      <div className={`bubble${isUser ? ' user' : ' assistant'}`}>
        {!isUser && msg.steps.length > 0 && <AgentTrace steps={msg.steps} streaming={msg.streaming} />}
        {msg.content ? (
          <div className={`content${msg.streaming ? ' typing' : ''}`}>{msg.content}</div>
        ) : (
          msg.streaming && <div className="thinking">Agent 正在思考…</div>
        )}
      </div>
    </div>
  )
}
