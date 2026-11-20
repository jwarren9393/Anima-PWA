import { PageHeader } from '../layout/PageHeader'

type Props = {
  title: string
  onBack: () => void
}

export function ComingSoonView({ title, onBack }: Props) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-2">
      <PageHeader title={title} onBack={onBack} />
      <div className="glass-panel px-5 py-8 text-center">
        <p className="text-[color:var(--color-muted)]">
          This screen arrives in a later phase. Chrome and Settings labels match the Flutter app so
          navigation stays familiar.
        </p>
      </div>
    </div>
  )
}
