import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, Empty, Select, Spin } from 'antd';
import { PlusOutlined, UserOutlined } from '@ant-design/icons';
import { ApplicationDetail } from '@/components/upwork/ApplicationDetail';
import { ApplicationList } from '@/components/upwork/ApplicationList';
import { CreateProjectModal } from '@/components/upwork/CreateProjectModal';
import { NewApplicationDrawer } from '@/components/upwork/NewApplicationDrawer';
import { ProfileDrawer } from '@/components/upwork/ProfileDrawer';
import { APPLICATION_STATUSES, STATUS_TAG } from '@/components/upwork/upworkFormat';
import { useUpworkApplications } from '@/hooks/useUpworkApplications';
import type { ApplicationStatus, ApplicationView } from '@/types/upwork';

const STATUS_OPTIONS = APPLICATION_STATUSES.map((status) => ({ value: status, label: STATUS_TAG[status].label }));

/**
 * Secção Upwork (spec docs/features/upwork.md, ADR 0022): lista de candidaturas à esquerda, a aberta à direita.
 * A app nunca fala com a Upwork — o anúncio entra colado, o pacote sai copiado.
 */
export function UpworkPage() {
  const [archived, setArchived] = useState(false);
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  /** Novo projeto pedido pelo menu de contexto: a candidatura cujo acordo se está a colar. */
  const [projectFor, setProjectFor] = useState<string | null>(null);
  /** Uma ação do menu sobre a candidatura aberta: o detalhe relê-a (guarda a sua cópia). */
  const [detailSignal, setDetailSignal] = useState(0);
  const upwork = useUpworkApplications(archived);

  const shown = useMemo(
    () => upwork.applications.filter((application) => status === null || application.status === status),
    [upwork.applications, status],
  );
  const hasProfile = upwork.profile?.updatedAt != null;

  // Sem perfil, Nova candidatura leva ao Perfil: a carta não tem de onde tirar a prova.
  const startNew = () => (hasProfile ? setCreating(true) : setProfileOpen(true));

  const openCreated = (application: ApplicationView) => {
    // Uma candidatura nova é sempre aberta (não arquivada) e em rascunho: a lista e o filtro passam a mostrá-la.
    if (archived) setArchived(false);
    setStatus(null);
    upwork.replace(application);
    setSelectedId(application.id);
  };

  // Como o agrupamento da Biblioteca ao mudar de separador: outra lista, filtros limpos.
  const toggleArchived = () => {
    setArchived((current) => !current);
    setStatus(null);
    setSelectedId(null);
  };

  const { remove } = upwork;
  // Apagada, arquivada (sai da lista aberta) ou já não existe: a lista perde-a e o painel fecha.
  const onRemoved = useCallback(
    (id: string) => {
      remove(id);
      setSelectedId((current) => (current === id ? null : current));
    },
    [remove],
  );

  const { replace } = upwork;
  const onMenuChanged = useCallback(
    (application: ApplicationView) => {
      replace(application);
      if (application.id === selectedId) setDetailSignal((n) => n + 1);
    },
    [replace, selectedId],
  );

  const renderList = () => {
    if (upwork.error) {
      return (
        <Alert
          type="error"
          showIcon
          title={upwork.error}
          action={
            <Button size="small" onClick={upwork.refresh}>
              Tentar de novo
            </Button>
          }
        />
      );
    }
    if (upwork.loading && upwork.profile === null) return <Spin className="mt-10" />;
    if (!hasProfile) {
      return (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Preenche o teu perfil primeiro — é dele que saem as cartas.">
          <Button type="primary" icon={<UserOutlined />} onClick={() => setProfileOpen(true)}>
            Perfil
          </Button>
        </Empty>
      );
    }
    if (upwork.applications.length === 0) {
      return archived ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma candidatura arquivada." />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Cola um anúncio da Upwork para começar.">
          <Button type="primary" icon={<PlusOutlined />} onClick={startNew}>
            Nova candidatura
          </Button>
        </Empty>
      );
    }
    if (shown.length === 0) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma candidatura com este estado." />;
    }
    return (
      <ApplicationList
        applications={shown}
        selectedId={selectedId}
        onSelect={(application) => setSelectedId(application.id)}
        onChanged={onMenuChanged}
        onRemoved={onRemoved}
        onCreateProject={setProjectFor}
      />
    );
  };

  return (
    <div className="h-full px-10 pt-7 pb-4 flex flex-col">
      <div className="flex items-end gap-4">
        <div className="flex-1 flex flex-col gap-1">
          <span className="kicker">Upwork</span>
          <h1 className="text-display m-0">Candidaturas</h1>
          <span className="text-[13.5px] text-text-2">
            Cola um anúncio e recebe a carta, as respostas de triagem e o plano. Nada aqui toca na Upwork.
          </span>
        </div>
        <Button icon={<UserOutlined />} onClick={() => setProfileOpen(true)}>
          Perfil
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={startNew}>
          Nova candidatura
        </Button>
      </div>

      <div className="mt-[22px] flex-1 min-h-0 flex gap-6">
        <section className="w-[380px] flex-none flex flex-col gap-3 min-h-0" aria-label="Lista de candidaturas">
          <div className="flex items-center gap-2">
            <Select
              className="flex-1"
              placeholder="Todos os estados"
              allowClear
              value={status}
              onChange={(value: ApplicationStatus | undefined) => setStatus(value ?? null)}
              options={STATUS_OPTIONS}
              aria-label="Filtrar por estado"
            />
            <button type="button" className="filter-chip" aria-pressed={archived} onClick={toggleArchived}>
              Arquivadas
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">{renderList()}</div>
          {!upwork.error && upwork.applications.length > 0 && (
            <p className="m-0 text-[12.5px] text-text-3">
              {upwork.applications.length} {archived ? 'arquivada(s)' : 'candidatura(s)'}
              {shown.length !== upwork.applications.length && ` · a mostrar ${shown.length}`}
            </p>
          )}
        </section>

        <section className="flex-1 min-w-0 min-h-0 overflow-auto border-l border-border pl-6 pr-1" aria-label="Candidatura aberta">
          {selectedId ? (
            <ApplicationDetail key={selectedId} id={selectedId} refreshSignal={detailSignal} onChanged={upwork.replace} onRemoved={onRemoved} />
          ) : (
            <Empty className="mt-16" image={Empty.PRESENTED_IMAGE_SIMPLE} description="Escolhe uma candidatura na lista." />
          )}
        </section>
      </div>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} profile={upwork.profile} onSaved={upwork.setProfile} />
      <CreateProjectModal applicationId={projectFor} onClose={() => setProjectFor(null)} />
      <NewApplicationDrawer
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={openCreated}
        onProfileMissing={() => setProfileOpen(true)}
      />
    </div>
  );
}
