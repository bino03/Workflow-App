import { CodeOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Spin, Tabs, Tooltip } from 'antd';
import { isAxiosError } from 'axios';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { GuidedConversation, GuidedModeSelect, GuidedStatusTag } from '@/components/guided/GuidedConversation';
import { ReplyBox } from '@/components/guided/ReplyBox';
import { ApplicationDataForm } from '@/components/upwork/ApplicationDataForm';
import { CreateProjectModal } from '@/components/upwork/CreateProjectModal';
import { PackageCards, PackagePlaceholder } from '@/components/upwork/PackageCards';
import { STATUS_TAG, VERDICT_TAG, canArchive } from '@/components/upwork/upworkFormat';
import { ErrorHandler } from '@/errors/errorHandler';
import { useApplicationActions } from '@/hooks/useApplicationActions';
import { useGuidedAct } from '@/hooks/useGuidedAct';
import { isLiveStatus, useGuidedSession } from '@/hooks/useGuidedSession';
import { revealGuided } from '@/services/guidedService';
import { getApplication, pauseApplication, sendApplicationMessage } from '@/services/upworkService';
import type { GuidedView } from '@/types/guided';
import type { ApplicationView } from '@/types/upwork';

/** O pacote muda enquanto a skill escreve; o feed já tem o seu polling (1,5 s), isto só apanha os ficheiros. */
const POLL_MS = 3000;

/** Numa candidatura, uma sessão parada é o normal: está em pausa até o dono escrever. */
const GUIDED_LABELS = { stopped: 'Em pausa' };

type Tab = 'package' | 'conversation' | 'data';

type ApplicationDetailProps = {
  id: string;
  /** Muda quando o menu de contexto da lista alterou esta candidatura: relê-a. */
  refreshSignal: number;
  /** Cada leitura volta à lista (o título e o veredicto chegam com o pacote). */
  onChanged: (application: ApplicationView) => void;
  onRemoved: (id: string) => void;
};

/**
 * A candidatura aberta (spec upwork §4.4): Pacote · Conversa · Dados, sem nenhum terminal à vista — a conversa é a
 * mesma do Novo projeto. Uma candidatura por montagem (`key={id}`).
 */
export function ApplicationDetail({ id, refreshSignal, onChanged, onRemoved }: ApplicationDetailProps) {
  const navigate = useNavigate();
  const [application, setApplication] = useState<ApplicationView | null>(null);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('package');
  const [creatingProject, setCreatingProject] = useState(false);
  const session = useGuidedSession(application?.guidedId ?? null);
  const refreshSession = session.refresh;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await getApplication(id);
        if (cancelled) return;
        setApplication(next);
        onChanged(next);
        if (isLiveStatus(next.guided)) timer = setTimeout(() => void load(), POLL_MS);
      } catch (e) {
        if (cancelled) return;
        if (isAxiosError(e) && e.response?.data?.errorCode === 'UPWORK_001') {
          ErrorHandler.handle(e, { showNotification: false });
          onRemoved(id);
          return;
        }
        ErrorHandler.handle(e, { showNotification: false });
        timer = setTimeout(() => void load(), POLL_MS * 2);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, tick, refreshSignal, onChanged, onRemoved]);

  const refresh = useCallback(() => {
    setTick((n) => n + 1);
    refreshSession();
  }, [refreshSession]);
  const { busy, act } = useGuidedAct(refresh);
  const actions = useApplicationActions({ onChanged, onRemoved, run: act });

  if (!application) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }

  // Depois de arquivada já não há sessão, mesmo que o hook ainda guarde a última vista.
  const view: GuidedView | null = application.guidedId ? (session.view ?? application.guided) : null;
  const running = view !== null && view.status !== 'stopped';
  const status = STATUS_TAG[application.status];
  const verdict = application.package ? VERDICT_TAG[application.package.verdict] : null;
  const archivable = canArchive(application);

  const reveal = () =>
    void act(async () => {
      if (!view) return;
      const terminal = await revealGuided(view.id);
      void navigate('/terminals', { state: { focusTerminalId: terminal.id } });
    });

  const send = (text: string) => act(() => sendApplicationMessage(id, text));

  const conversation = (): ReactNode => {
    if (!view) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={application.archived ? 'A conversa foi apagada ao arquivar — o pacote ficou.' : 'A sessão desta candidatura já não existe.'}
        />
      );
    }
    let endPanel: ReactNode = null;
    if (view.status === 'stopped') {
      endPanel = (
        <div className="flex flex-col gap-3">
          <div className="status-banner is-stop flex items-center gap-3 px-4 py-2.5" role="status">
            <span className={`state-icon ${busy ? 'is-work' : 'is-stop'}`} aria-hidden />
            <span className="flex-1 text-[13.5px] leading-[20px]">
              {busy ? 'A retomar a sessão…' : 'Em pausa, sem terminal aberto. Escrever aqui retoma a conversa — demora uns segundos.'}
            </span>
          </div>
          <ReplyBox busy={busy} onSend={send} placeholder="Cola a mensagem do cliente, ou pede o que precisas…" />
        </div>
      );
    } else if (view.status === 'failed') {
      endPanel = (
        <div className="status-banner is-err flex items-center gap-3 px-4 py-2.5" role="status">
          <span className="state-icon is-err" aria-hidden />
          <span className="flex-1 text-[13.5px] leading-[20px]">{view.error ?? 'A sessão terminou com um erro.'}</span>
          <Button size="small" disabled={busy} onClick={reveal}>
            Ver terminal
          </Button>
        </div>
      );
    }
    return (
      <GuidedConversation view={view} entries={session.entries} busy={busy} act={act} onReveal={reveal} onSend={send} endPanel={endPanel} copyable />
    );
  };

  const waitingOnYou = view !== null && ['question', 'permission', 'needs-you'].includes(view.status);

  const packageTab = (): ReactNode => {
    if (application.packageError) {
      return (
        <div className="flex flex-col gap-4">
          <Alert type="warning" showIcon title="O pacote não se leu" description={<span className="font-mono text-[12px]">{application.packageError}</span>} />
          {view && conversation()}
        </div>
      );
    }
    if (!application.package) {
      // A gerar: os cartões em espera e a conversa por baixo (uma pergunta da skill tem de se ver aqui).
      return (
        <div className="flex flex-col gap-6">
          <PackagePlaceholder />
          {conversation()}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {waitingOnYou && (
          <div className="status-banner is-wait flex items-center gap-3 px-4 py-2.5" role="status">
            <span className="state-icon is-wait" aria-hidden />
            <span className="flex-1 text-[13.5px] leading-[20px]">O Claude está à tua espera na conversa.</span>
            <Button size="small" type="primary" onClick={() => setTab('conversation')}>
              Ir para a Conversa
            </Button>
          </div>
        )}
        <PackageCards pack={application.package} />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <h2 className="m-0 text-[20px] leading-[26px] font-semibold text-text-1">{application.title}</h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={status.className}>{status.label}</span>
            {verdict && <span className={verdict.className}>{verdict.label}</span>}
            {view && <GuidedStatusTag status={view.status} labels={GUIDED_LABELS} />}
            {application.archived && <span className="tag">Arquivada</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {running && <GuidedModeSelect view={view} busy={busy} act={act} />}
          {running && !application.archived && (
            <Button size="small" disabled={busy} onClick={() => void act(() => pauseApplication(id))}>
              Pausar
            </Button>
          )}
          {application.status === 'won' && !application.archived && application.projectPath === null && (
            <Button size="small" type="primary" disabled={busy} onClick={() => setCreatingProject(true)}>
              Criar projeto
            </Button>
          )}
          {application.creationGuidedId && application.projectPath === null && (
            <Button size="small" disabled={busy} onClick={() => void navigate('/new-project')}>
              Ver criação
            </Button>
          )}
          {application.projectPath && (
            <Button size="small" type="primary" disabled={busy} onClick={() => actions.openProject(application.projectPath!)}>
              Abrir projeto
            </Button>
          )}
          {!application.archived && (
            <Tooltip title={archivable ? undefined : 'Marca-a como Perdida ou Retirada (ou Ganha, com o projeto criado) primeiro'}>
              <Button size="small" disabled={busy || !archivable} onClick={() => actions.archive(application)}>
                Arquivar
              </Button>
            </Tooltip>
          )}
          {application.archived && (
            <Button size="small" type="text" danger disabled={busy} onClick={() => actions.remove(application)}>
              Apagar
            </Button>
          )}
          {running && (
            <Button size="small" type="text" icon={<CodeOutlined />} disabled={busy} onClick={reveal}>
              Ver terminal
            </Button>
          )}
        </div>
      </div>

      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as Tab)}
        destroyOnHidden
        items={[
          { key: 'package', label: 'Pacote', children: packageTab() },
          { key: 'conversation', label: 'Conversa', children: conversation() },
          {
            key: 'data',
            label: 'Dados',
            children: (
              <ApplicationDataForm
                application={application}
                onSaved={(updated) => {
                  setApplication(updated);
                  onChanged(updated);
                  refresh();
                }}
              />
            ),
          },
        ]}
      />

      <CreateProjectModal applicationId={creatingProject ? id : null} onClose={() => setCreatingProject(false)} />
    </div>
  );
}
