export default function Sheet({ title, body, confirmLabel, onConfirm, onCancel, children }) {
  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        {title && <h3 className="sheet-title">{title}</h3>}
        {body && <p className="sheet-body">{body}</p>}
        {children}
        {onConfirm && (
          <button className="btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        )}
        {onCancel && (
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </div>
  )
}
