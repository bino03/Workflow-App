import type { ReactNode } from 'react';
import type { Environment, ProjectInfo } from '@/types/projectInfo';
import { ENVIRONMENT_KIND_LABEL, displayUrl, lifecycleLabel, lifecycleTagClass } from './projectInfoFormat';

const DASH = <span className="text-text-3">—</span>;

/** Um endereço guardado como link: nova janela, sem `opener` nem `referrer`. */
function ExternalLink({ url }: { url: string | null }) {
  if (!url) return DASH;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono text-[12.5px] text-accent hover:text-accent-hover break-all">
      {displayUrl(url)}
    </a>
  );
}

function Rows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="m-0 grid grid-cols-[150px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-text-3">{row.label}</dt>
          <dd className="m-0 text-text-1 min-w-0">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 pb-2 text-[16px] leading-6 font-semibold text-text-1 border-b border-border">{title}</h3>
      {children}
    </section>
  );
}

const money = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

function EnvironmentView({ environment }: { environment: Environment }) {
  return (
    <div className="p-4 border border-border rounded-md bg-surface-2 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h4 className="m-0 text-[14px] font-semibold text-text-1">{environment.name}</h4>
        <span className="tag">{ENVIRONMENT_KIND_LABEL[environment.kind]}</span>
      </div>
      <Rows
        rows={[
          { label: 'URL', value: <ExternalLink url={environment.url} /> },
          { label: 'Hosting', value: environment.hosting ?? DASH },
          { label: 'Branch / versão', value: environment.version ? <span className="font-mono text-[12.5px]">{environment.version}</span> : DASH },
          { label: 'Painel do hosting', value: <ExternalLink url={environment.dashboardUrl} /> },
          { label: 'Logs', value: <ExternalLink url={environment.logsUrl} /> },
          { label: 'Health check', value: <ExternalLink url={environment.healthUrl} /> },
          { label: 'Custo mensal', value: environment.monthlyCostEur === null ? DASH : money.format(environment.monthlyCostEur) },
        ]}
      />
    </div>
  );
}

/** A ficha de um projeto em modo de leitura. Sem ficha (`info` indefinido), só o convite a preenchê-la. */
export function ProjectInfoDetails({ info }: { info: ProjectInfo | undefined }) {
  if (!info) {
    return <p className="m-0 text-[13.5px] text-text-2">Ainda não há informação sobre este projeto. Carrega em Editar para a preencher.</p>;
  }
  return (
    <div className="flex flex-col gap-7">
      <Section title="Ciclo de vida">
        <Rows
          rows={[
            { label: 'Estado', value: info.lifecycle ? <span className={lifecycleTagClass(info.lifecycle)}>{lifecycleLabel(info.lifecycle)}</span> : DASH },
            { label: 'Cliente / dono', value: info.client ?? DASH },
          ]}
        />
      </Section>

      <Section title="Ambientes">
        {info.environments.length === 0 ? <p className="m-0 text-[13px] text-text-3">Nenhum ambiente.</p> : info.environments.map((environment) => <EnvironmentView key={environment.id} environment={environment} />)}
      </Section>

      <Section title="Código e infra">
        <Rows
          rows={[
            { label: 'Repositório', value: <ExternalLink url={info.repoUrl} /> },
            { label: 'Base de dados', value: info.database ?? DASH },
            { label: 'CI/CD', value: info.ci ?? DASH },
            { label: 'Domínio', value: info.domain ? <span className="font-mono text-[12.5px]">{info.domain.name}</span> : DASH },
            { label: 'Registado em', value: info.domain?.registrar ?? DASH },
            { label: 'Renova em', value: info.domain?.renewsAt ? <span className="font-mono text-[12.5px]">{info.domain.renewsAt}</span> : DASH },
          ]}
        />
      </Section>

      <Section title="Links">
        {info.links.length === 0 ? (
          <p className="m-0 text-[13px] text-text-3">Nenhum link.</p>
        ) : (
          <Rows rows={info.links.map((link) => ({ label: link.label, value: <ExternalLink url={link.url} /> }))} />
        )}
      </Section>

      <Section title="Notas">
        {info.notes ? <p className="m-0 text-[13.5px] leading-[21px] text-text-1 whitespace-pre-wrap">{info.notes}</p> : <p className="m-0 text-[13px] text-text-3">Sem notas.</p>}
      </Section>
    </div>
  );
}
