import type { Deploy, Environment, Lifecycle, ProjectInfo } from '@/types/projectInfo';

export const LIFECYCLES: readonly Lifecycle[] = ['development', 'production', 'maintenance', 'paused', 'archived'];

const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  development: 'Em desenvolvimento',
  production: 'Em produção',
  maintenance: 'Em manutenção',
  paused: 'Em pausa',
  archived: 'Arquivado',
};

export function lifecycleLabel(lifecycle: Lifecycle): string {
  return LIFECYCLE_LABEL[lifecycle];
}

/** Só a produção leva o acento; as cores de estado são dos terminais (tokens-and-colors §3). */
export function lifecycleTagClass(lifecycle: Lifecycle): string {
  return lifecycle === 'production' ? 'tag text-accent bg-accent-subtle border-accent-border' : 'tag';
}

/** O ambiente que o cartão mostra: o de produção, senão o primeiro. */
export function primaryEnvironment(info: ProjectInfo | undefined): Environment | undefined {
  if (!info) return undefined;
  return info.environments.find((environment) => environment.kind === 'production') ?? info.environments[0];
}

/** O deploy mais recente de um ambiente (a lista vem do backend mais recente primeiro, mas não se confia nisso). */
export function lastDeploy(environment: Environment | undefined): Deploy | undefined {
  if (!environment) return undefined;
  return environment.deploys.reduce<Deploy | undefined>(
    (latest, deploy) => (latest === undefined || Date.parse(deploy.at) > Date.parse(latest.at) ? deploy : latest),
    undefined,
  );
}

/** O "último deploy" do cartão: o do ambiente de produção; sem ele, o mais recente de qualquer ambiente. */
export function lastDeployOfProject(info: ProjectInfo | undefined): Deploy | undefined {
  if (!info) return undefined;
  const fromPrimary = lastDeploy(primaryEnvironment(info));
  if (fromPrimary) return fromPrimary;
  return info.environments
    .map((environment) => lastDeploy(environment))
    .reduce<Deploy | undefined>(
      (latest, deploy) => (deploy && (latest === undefined || Date.parse(deploy.at) > Date.parse(latest.at)) ? deploy : latest),
      undefined,
    );
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "há 3 dias". Datas no futuro (relógio desacertado) leem-se como "agora". */
export function relativeDeploy(at: string, now: number = Date.now()): string {
  const elapsed = now - Date.parse(at);
  if (elapsed < MINUTE) return 'agora mesmo';
  if (elapsed < HOUR) return `há ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return hours === 1 ? 'há 1 hora' : `há ${hours} horas`;
  }
  if (elapsed < 30 * DAY) {
    const days = Math.floor(elapsed / DAY);
    return days === 1 ? 'há 1 dia' : `há ${days} dias`;
  }
  if (elapsed < 365 * DAY) {
    const months = Math.floor(elapsed / (30 * DAY));
    return months === 1 ? 'há 1 mês' : `há ${months} meses`;
  }
  const years = Math.floor(elapsed / (365 * DAY));
  return years === 1 ? 'há 1 ano' : `há ${years} anos`;
}

/** O endereço sem o protocolo, para caber no cartão: `https://app.exemplo.pt/x` → `app.exemplo.pt/x`. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}
