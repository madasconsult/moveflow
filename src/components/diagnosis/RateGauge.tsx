import { formatRateScore } from '@/lib/rate-faus'

interface RateGaugeProps {
  score: number | null
}

export function RateGauge({ score }: RateGaugeProps) {
  const safeScore = score ?? 0
  const progress = Math.max(0, Math.min(100, (safeScore / 5) * 100))
  const radius = 64
  const stroke = 16
  const circumference = Math.PI * radius
  const dashOffset = circumference - (progress / 100) * circumference

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
            Rate geral
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Resultado ponderado da versão ativa em uma escala de 0 a 5.
          </p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          {score === null ? 'Sem notas' : `${Math.round(progress)}%`}
        </span>
      </div>

      <div className="mt-6 flex justify-center">
        <svg viewBox="0 0 180 110" className="h-40 w-full max-w-[16rem]">
          <path
            d="M 26 90 A 64 64 0 0 1 154 90"
            fill="none"
            stroke="#e5edf6"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d="M 26 90 A 64 64 0 0 1 154 90"
            fill="none"
            stroke="#144b91"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            style={{ transformOrigin: 'center', transform: 'rotate(0deg)' }}
          />
          <text x="90" y="74" textAnchor="middle" fontSize="30" fontWeight="700" fill="#0f172a">
            {formatRateScore(score)}
          </text>
          <text x="90" y="94" textAnchor="middle" fontSize="12" fill="#64748b">
            / 5,0
          </text>
        </svg>
      </div>
    </div>
  )
}
