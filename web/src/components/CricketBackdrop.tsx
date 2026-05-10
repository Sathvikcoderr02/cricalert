"use client";

import Image from "next/image";

/** Cricket / stadium scene — Unsplash (free to use under Unsplash License). */
const STADIUM_SRC =
  "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&w=2400&q=85";

export function CricketBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-full">
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        <Image
          src={STADIUM_SRC}
          alt=""
          fill
          priority
          className="cricket-bg-zoom object-cover opacity-[0.38] saturate-[1.15] contrast-[1.05]"
          sizes="100vw"
        />

        {/* Pitch / night tint */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-emerald-950/45 to-slate-950/94" />
        <div className="cricket-floodlights absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(52,211,153,0.22),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(ellipse_80%_50%_at_0%_50%,rgba(16,185,129,0.1),transparent_45%)]" />
        <div className="cricket-aurora absolute -inset-[20%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.08),transparent_25%,rgba(59,130,246,0.06),transparent_50%,rgba(52,211,153,0.07),transparent_75%)] blur-3xl" />

        {/* Crease lines */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 48px,
              rgba(255,255,255,0.9) 48px,
              rgba(255,255,255,0.9) 50px
            )`,
          }}
        />

        {/* Decorative 3D-style cricket ball */}
        <div className="absolute -right-4 bottom-[18%] hidden opacity-90 sm:block md:right-8">
          <div className="cricket-ball-3d flex h-28 w-28 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#fef3c7,#b45309_35%,#451a03_70%)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.65),inset_0_-8px_16px_rgba(0,0,0,0.35)] ring-2 ring-amber-900/40">
            <div className="h-[72%] w-[72%] rounded-full border border-amber-950/30 opacity-60" />
          </div>
        </div>

        {/* Soft vignette */}
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
