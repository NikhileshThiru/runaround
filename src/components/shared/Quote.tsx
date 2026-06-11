export default function Quote() {
  return (
    <figure className="mx-auto max-w-4xl text-center">
      <div className="mb-6 flex items-center justify-center gap-3" aria-hidden="true">
        <span className="h-px w-10 bg-gradient-to-r from-transparent to-glow/60" />
        <span className="instrument-label text-glow">Lifetime movement system</span>
        <span className="h-px w-10 bg-gradient-to-l from-transparent to-glow/60" />
      </div>
      <blockquote className="font-display text-xl leading-relaxed tracking-[0.02em] text-primary sm:text-3xl lg:text-[2rem]">
        “The only way to define your limits is by going beyond them.”
      </blockquote>
      <figcaption className="mt-4 font-mono text-[10px] uppercase tracking-[0.34em] text-glow">
        Arthur C. Clarke
      </figcaption>
    </figure>
  )
}
