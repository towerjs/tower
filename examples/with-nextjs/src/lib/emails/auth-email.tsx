type AuthEmailProps = {
  heading: string
  intro: string
  actionLabel: string
  actionUrl: string
}

export function AuthEmailTemplate(props: AuthEmailProps) {
  return (
    <div
      style={{
        fontFamily: 'Inter, -apple-system, Segoe UI, sans-serif',
        maxWidth: '560px',
        margin: '0 auto',
        color: '#111827',
      }}
    >
      <h2 style={{ margin: '0 0 16px', fontSize: '24px' }}>{props.heading}</h2>
      <p style={{ margin: '0 0 20px', lineHeight: 1.5 }}>{props.intro}</p>
      <p style={{ margin: '0 0 24px' }}>
        <a
          href={props.actionUrl}
          style={{
            display: 'inline-block',
            background: '#111827',
            color: '#ffffff',
            textDecoration: 'none',
            padding: '10px 16px',
            borderRadius: '8px',
          }}
        >
          {props.actionLabel}
        </a>
      </p>
      <p style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
        If the button does not work, use this URL:
        <br />
        <a href={props.actionUrl}>{props.actionUrl}</a>
      </p>
    </div>
  )
}
