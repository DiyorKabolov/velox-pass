export default function Card({ as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag
      className={[
        'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </Tag>
  )
}
