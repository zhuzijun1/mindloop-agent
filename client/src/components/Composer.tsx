import { useRef, useState } from 'react'

interface ComposerProps {
  streaming: boolean
  onSend: (text: string) => void
  onStop: () => void
}

/** 输入区：Enter 发送、Shift+Enter 换行、流式期间可停止生成 */
export function Composer({ streaming, onSend, onStop }: ComposerProps) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement | null>(null)

  const submit = () => {
    if (!text.trim() || streaming) return
    onSend(text)
    setText('')
    ref.current?.focus()
  }

  return (
    <div className="composer">
      <textarea
        ref={ref}
        rows={2}
        value={text}
        placeholder="给 MindLoop 发消息…（Enter 发送，Shift+Enter 换行）"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
      />
      {streaming ? (
        <button className="send stop" onClick={onStop} title="停止生成">
          ◼ 停止
        </button>
      ) : (
        <button className="send" onClick={submit} disabled={!text.trim()} title="发送">
          ➤ 发送
        </button>
      )}
    </div>
  )
}
