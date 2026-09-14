import { useId } from 'react'

export function Field({ label, value, onChange, type = 'text', required = false, integer = false, signed = false, list }) {
  const id = useId()
  return <p><label htmlFor={id}>{label}</label><br />{type === 'textarea'
    ? <textarea id={id} rows={4} cols={24} value={value ?? ''} required={required} onChange={event => onChange(event.target.value)} />
    : <input id={id} type={type} value={value ?? ''} required={required} list={list}
      min={type === 'number' && !signed ? 0 : undefined} step={type === 'number' ? (integer ? 1 : 'any') : undefined}
      onChange={event => onChange(event.target.value)} />}</p>
}
export function Checkbox({ label, checked, onChange }) {
  return <p><label><input type="checkbox" checked={Boolean(checked)} onChange={event => onChange(event.target.checked)} /> {label}</label></p>
}
export function Feedback({ status, error }) {
  return <><p role="status">{status}</p>{error && <p role="alert">{error}</p>}</>
}
export function RecordDetails({ row }) {
  return <dl>{Object.entries(row).filter(([, value]) => value !== null && value !== undefined).map(([key, value]) =>
    <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>
}
