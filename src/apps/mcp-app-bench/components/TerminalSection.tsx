import { ReactNode } from "react"

interface TerminalSectionProps {
  title: string
  children: ReactNode
}

export function TerminalSection({ title, children }: TerminalSectionProps) {
  return (
    <div className="terminal-section">
      <h2>{title}</h2>
      {children}
    </div>
  )
}
