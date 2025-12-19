import { ReactNode } from "react"

interface ActionButtonProps {
  onClick: () => void
  children: ReactNode
  code: string
  disabled?: boolean
}

export function ActionButton({
  onClick,
  children,
  code,
  disabled,
}: ActionButtonProps) {
  return (
    <button className="action-btn" onClick={onClick} disabled={disabled}>
      {children} <code>{code}</code>
    </button>
  )
}
