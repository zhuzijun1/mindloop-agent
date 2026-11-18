const EXAMPLES: { icon: string; label: string; question: string }[] = [
  { icon: '🧮', label: '算术计算', question: '帮我算 128*7' },
  { icon: '🕐', label: '时区时间', question: '现在纽约时间几点？' },
  { icon: '📏', label: '单位换算', question: '5公里换算成英里' },
  { icon: '📝', label: '记录备忘', question: '记一下：周五前把简历投出去' },
  { icon: '🤖', label: 'Agent 是什么', question: '简单介绍一下 ReAct Agent 的工作方式' },
]

export function EmptyState({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="empty-state">
      <div className="empty-logo">∞</div>
      <h2>开始一段与 Agent 的对话</h2>
      <p className="empty-desc">
        MindLoop 会先规划、再调用工具、观察结果，最后给出回答。试试下面的示例：
      </p>
      <div className="examples">
        {EXAMPLES.map((e) => (
          <button key={e.label} className="example" onClick={() => onPick(e.question)}>
            <span className="example-icon">{e.icon}</span>
            <span className="example-label">{e.label}</span>
            <span className="example-question">{e.question}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
