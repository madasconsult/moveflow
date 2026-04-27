import {
  ArrowDown,
  ArrowRight,
  CircleDot,
  Fish,
  SearchCheck,
  Target,
} from 'lucide-react'
import type { Fsp } from '@/types/database.types'

interface FspMethodViewProps {
  fsp: Fsp
}

function ValueBlock({
  title,
  value,
  tone = 'neutral',
}: {
  title: string
  value: string | null
  tone?: 'neutral' | 'danger' | 'success' | 'accent'
}) {
  const toneClass = {
    neutral: 'border-neutral-200 bg-white',
    danger: 'border-rose-200 bg-rose-50/70',
    success: 'border-emerald-200 bg-emerald-50/70',
    accent: 'border-sky-200 bg-sky-50/70',
  }[tone]

  return (
    <div className={`rounded-3xl border p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] ${toneClass}`}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
        {title}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
        {value?.trim() || 'Não informado.'}
      </p>
    </div>
  )
}

function FiveWhysView({ fsp }: FspMethodViewProps) {
  const whySteps = [fsp.why_1, fsp.why_2, fsp.why_3, fsp.why_4, fsp.why_5]

  return (
    <div className="space-y-5">
      <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef5fd_100%)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <SearchCheck size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Problema central
            </p>
            <p className="mt-1 text-base font-semibold text-slate-950">
              {fsp.problem_statement}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {whySteps.map((item, index) => (
          <div key={index} className="space-y-3">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">
                {index + 1}
              </div>
              <div className="flex-1 rounded-3xl border border-brand-100 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-500">
                  Por quê {index + 1}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {item?.trim() || 'Não informado.'}
                </p>
              </div>
            </div>
            {index < whySteps.length - 1 && (
              <div className="flex pl-5">
                <ArrowDown size={18} className="text-slate-300" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ValueBlock title="Conclusão do método" value={fsp.five_whys_conclusion} tone="accent" />
        <ValueBlock title="Causa raiz consolidada" value={fsp.root_cause} tone="danger" />
        <div className="lg:col-span-2">
          <ValueBlock title="Recomendação / ação proposta" value={fsp.recommendation} tone="success" />
        </div>
      </div>
    </div>
  )
}

function IshikawaView({ fsp }: FspMethodViewProps) {
  const branches = [
    { title: 'Método', value: fsp.ishikawa_method },
    { title: 'Mão de obra', value: fsp.ishikawa_labor },
    { title: 'Máquina', value: fsp.ishikawa_machine },
    { title: 'Material', value: fsp.ishikawa_material },
    { title: 'Medição', value: fsp.ishikawa_measurement },
    { title: 'Meio ambiente', value: fsp.ishikawa_environment },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f3f8fd_100%)] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Ishikawa
            </p>
            <p className="mt-1 text-base font-semibold text-slate-950">
              Espinha de peixe da causa
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Fish size={20} />
          </div>
        </div>

        <div className="relative mt-8 overflow-x-auto">
          <div className="relative min-w-[980px] px-6 py-10">
            <div className="absolute left-12 right-44 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-slate-300" />

            <div className="absolute right-0 top-1/2 flex w-40 -translate-y-1/2 items-center gap-3 rounded-[28px] border border-rose-200 bg-rose-50/80 px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <Target size={20} className="text-rose-600" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-400">
                  Problema
                </p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-rose-900">
                  {fsp.problem_statement}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-x-8 gap-y-16 pr-48">
              {branches.map((branch, index) => {
                const topBranch = index < 3
                return (
                  <div key={branch.title} className={`relative ${topBranch ? 'pb-12' : 'pt-12'}`}>
                    <div
                      className={`absolute left-1/2 h-12 w-px -translate-x-1/2 bg-slate-300 ${
                        topBranch ? 'bottom-0' : 'top-0'
                      }`}
                    />
                    <div
                      className={`absolute left-1/2 h-px w-16 bg-slate-300 ${
                        topBranch ? 'bottom-10 rotate-[-28deg]' : 'top-10 rotate-[28deg]'
                      } origin-left`}
                    />
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.06)]">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {branch.title}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                        {branch.value?.trim() || 'Não informado.'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ValueBlock title="Notas adicionais" value={fsp.ishikawa_additional_notes} tone="accent" />
        <ValueBlock title="Conclusão do método" value={fsp.ishikawa_conclusion} tone="neutral" />
        <ValueBlock title="Causa raiz consolidada" value={fsp.root_cause} tone="danger" />
        <ValueBlock title="Recomendação / ação proposta" value={fsp.recommendation} tone="success" />
      </div>
    </div>
  )
}

function StructuredAnalysisView({ fsp }: FspMethodViewProps) {
  const executiveBlocks = [
    { title: 'Problema', value: fsp.structured_observed_problem ?? fsp.problem_statement, tone: 'danger' as const },
    { title: 'Impacto', value: fsp.structured_effect_impact ?? fsp.impact, tone: 'accent' as const },
    { title: 'Evidências', value: fsp.structured_evidence_notes ?? fsp.evidence, tone: 'neutral' as const },
    { title: 'Hipótese de causa', value: fsp.structured_cause_hypothesis, tone: 'neutral' as const },
    { title: 'Causa provável', value: fsp.structured_probable_cause ?? fsp.probable_cause, tone: 'accent' as const },
    { title: 'Causa raiz', value: fsp.structured_root_cause ?? fsp.root_cause, tone: 'danger' as const },
    { title: 'Recomendação / solução proposta', value: fsp.structured_recommendation ?? fsp.recommendation, tone: 'success' as const },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8fc_100%)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <CircleDot size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Análise estruturada
            </p>
            <p className="mt-1 text-base font-semibold text-slate-950">
              Quadro executivo da lógica causal
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
          <ValueBlock title={executiveBlocks[0].title} value={executiveBlocks[0].value} tone={executiveBlocks[0].tone} />
          <div className="hidden items-center justify-center lg:flex">
            <ArrowRight size={18} className="text-slate-300" />
          </div>
          <ValueBlock title={executiveBlocks[1].title} value={executiveBlocks[1].value} tone={executiveBlocks[1].tone} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {executiveBlocks.slice(2, 6).map(block => (
          <ValueBlock key={block.title} title={block.title} value={block.value} tone={block.tone} />
        ))}
      </div>

      <ValueBlock title={executiveBlocks[6].title} value={executiveBlocks[6].value} tone={executiveBlocks[6].tone} />
    </div>
  )
}

export function FspMethodView({ fsp }: FspMethodViewProps) {
  if (fsp.method_type === 'five_whys') {
    return <FiveWhysView fsp={fsp} />
  }

  if (fsp.method_type === 'ishikawa') {
    return <IshikawaView fsp={fsp} />
  }

  return <StructuredAnalysisView fsp={fsp} />
}
