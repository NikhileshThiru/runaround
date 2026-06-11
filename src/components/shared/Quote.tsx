export default function Quote() {
  return (
    <figure className="mx-auto flex max-w-3xl items-center justify-center gap-4 text-center">
      <span aria-hidden="true" className="h-px w-12 bg-gradient-to-r from-transparent to-neon/50" />
      <blockquote className="font-mono text-[11px] uppercase tracking-[0.18em] text-secondary">
        “The only way to define your limits is by going beyond them.”
        <cite className="ml-3 not-italic text-glow">— Arthur C. Clarke</cite>
      </blockquote>
      <span aria-hidden="true" className="h-px w-12 bg-gradient-to-l from-transparent to-neon/50" />
    </figure>
  )
}
