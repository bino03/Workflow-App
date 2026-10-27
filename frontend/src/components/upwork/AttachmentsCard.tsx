import { DownloadOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { Alert, Button } from 'antd';
import { useState } from 'react';
import { CopyButton } from '@/components/common/CopyButton';
import { attachmentUrl, prepareAttachments } from '@/services/upworkService';
import type { AttachmentsView, PreparedAttachments } from '@/types/upwork';

type Item = AttachmentsView['items'][number];

/**
 * A app aberta na própria máquina do backend (ADR 0026): aí o Explorador abre a pasta dos anexos. Noutro dispositivo
 * (o portátil, pela rede ou pelo Tailscale) a pasta ficava no ecrã do servidor — descarrega-se para este computador.
 */
const AT_THIS_MACHINE = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

/** Pausa entre downloads: o Chrome junta vários seguidos num pedido de autorização, e uns ms evitam perder algum. */
const DOWNLOAD_GAP_MS = 350;

/** Descarrega cada print para a pasta Downloads deste computador, com o nome para a Upwork (o backend dá-o). */
async function downloadAll(applicationId: string, items: Item[]): Promise<number> {
  let count = 0;
  for (const [index, item] of items.entries()) {
    if (!item.available) continue;
    const link = document.createElement('a');
    link.href = attachmentUrl(applicationId, index, true);
    link.download = item.uploadName;
    document.body.append(link);
    link.click();
    link.remove();
    count++;
    await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_GAP_MS));
  }
  return count;
}

/** Todas as legendas de uma vez, pela ordem de anexar — para colar numa nota ou na própria carta. */
function allCaptions(items: Item[]): string {
  return items.map((item, index) => `${index + 1}. ${item.uploadName} — ${item.caption}`).join('\n');
}

function AttachmentTile({ applicationId, item, index, showImage }: { applicationId: string; item: Item; index: number; showImage: boolean }) {
  const canShow = showImage && item.available;
  return (
    <figure className="m-0 flex flex-col gap-2 rounded-md border border-border bg-surface-1 p-3" aria-label={`Print ${index + 1}`}>
      <div className="aspect-video overflow-hidden rounded-sm bg-surface-2 flex items-center justify-center">
        {canShow ? (
          <img src={attachmentUrl(applicationId, index)} alt={item.caption} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <span className="px-3 text-center text-[12px] text-text-3">
            {showImage ? 'Imagem não encontrada no portfólio' : 'Sem PORTFOLIO_PATH: só a lista'}
            <br />
            <span className="font-mono">
              {item.slug}/{item.file}
            </span>
          </span>
        )}
      </div>
      <figcaption className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-3">{index + 1}</span>
          <span className="truncate font-mono text-[12px] text-text-2" title={item.uploadName}>
            {item.uploadName}
          </span>
          <span className="flex-1" />
          <Button size="small" type="text" icon={<DownloadOutlined />} href={attachmentUrl(applicationId, index, true)} disabled={!canShow}>
            Descarregar
          </Button>
        </div>
        <p className="m-0 text-[13px] leading-[19px] text-text-1">{item.caption}</p>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-3">{item.project}</span>
          <span className="flex-1" />
          <CopyButton text={item.caption} label="Copiar legenda" />
        </div>
      </figcaption>
    </figure>
  );
}

/**
 * O que fazer a seguir: na própria máquina, a pasta e quantos ficheiros; noutro dispositivo, onde ficaram os downloads.
 * Nos dois casos, o que ficou de fora.
 */
function PreparedBanner({ prepared, downloaded }: { prepared: PreparedAttachments; downloaded: number | null }) {
  const files = (n: number) => (n === 1 ? '1 ficheiro' : `${n} ficheiros`);
  return (
    <div className="status-banner is-done flex flex-col gap-1 px-4 py-2.5" role="status">
      {downloaded !== null ? (
        <span className="text-[13.5px] leading-[20px]">
          {`${files(downloaded)} descarregados para a pasta Downloads deste computador (ex.: ${prepared.files[0]}). Na proposta da Upwork, anexa-os a partir daí.`}
        </span>
      ) : (
        <>
          <span className="text-[13.5px] leading-[20px]">
            {prepared.opened
              ? `Pasta aberta no Explorador: seleciona os ${files(prepared.files.length)} (Ctrl+A) e arrasta-os para os anexos da proposta na Upwork.`
              : `${files(prepared.files.length)} prontos nesta pasta — abre-a e arrasta-os para os anexos da proposta na Upwork.`}
          </span>
          <span className="flex items-center gap-2">
            <span className="truncate font-mono text-[12px] text-text-2" title={prepared.folder}>
              {prepared.folder}
            </span>
            <CopyButton text={prepared.folder} label="Copiar caminho" />
          </span>
        </>
      )}
      {prepared.skipped.length > 0 && (
        <span className="text-[12px] text-text-3">Ficaram de fora (não estão no portfólio): {prepared.skipped.join(', ')}</span>
      )}
    </div>
  );
}

/**
 * Os prints a anexar à proposta (ADR 0024): escolhidos pelo `/upwork-proposal` dos catálogos do portfólio. O upload na
 * Upwork é à mão — **Preparar anexos** (ADR 0025) põe-nos numa pasta, com o nome que o cliente vai ver, e abre-a no
 * Explorador para os arrastar de uma vez; cada um também se descarrega sozinho.
 */
export function AttachmentsCard({ applicationId, attachments, error }: { applicationId: string; attachments: AttachmentsView | null; error: string | null }) {
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<PreparedAttachments | null>(null);
  const [downloaded, setDownloaded] = useState<number | null>(null);

  // Nos dois sítios a cópia fica no servidor (o registo do que foi enviado); fora da máquina, descarrega-se também.
  const prepare = async () => {
    setPreparing(true);
    try {
      const result = await prepareAttachments(applicationId);
      setDownloaded(AT_THIS_MACHINE ? null : await downloadAll(applicationId, attachments?.items ?? []));
      setPrepared(result);
    } catch {
      // O interceptor da API já notificou (UPWORK_007).
      setPrepared(null);
    } finally {
      setPreparing(false);
    }
  };

  if (error) {
    return <Alert type="warning" showIcon title="Os prints não se leram" description={<span className="font-mono text-[12px]">{error}</span>} />;
  }
  // Um pacote de antes dos prints, ou a skill ainda a escrever: nada a mostrar.
  if (!attachments) return null;
  const { items, missing, portfolioConfigured } = attachments;
  const canPrepare = portfolioConfigured && items.some((item) => item.available);
  return (
    <section className="card p-4 flex flex-col gap-3" aria-label="Prints a anexar">
      <div className="flex items-center gap-2">
        <span className="text-[14px] leading-[20px] font-semibold text-text-1">Prints a anexar</span>
        <span className="text-[12px] text-text-3">para o cliente · {items.length === 1 ? '1 print' : `${items.length} prints`}</span>
        <span className="flex-1" />
        {items.length > 0 && <CopyButton text={allCaptions(items)} label="Copiar legendas" />}
        {items.length > 0 && (
          <Button
            size="small"
            type="primary"
            icon={AT_THIS_MACHINE ? <FolderOpenOutlined /> : <DownloadOutlined />}
            loading={preparing}
            disabled={!canPrepare}
            onClick={() => void prepare()}
          >
            {AT_THIS_MACHINE ? 'Preparar anexos' : 'Descarregar todos'}
          </Button>
        )}
      </div>
      {prepared && <PreparedBanner prepared={prepared} downloaded={downloaded} />}
      {!portfolioConfigured && (
        <Alert type="info" showIcon title="Define PORTFOLIO_PATH no backend/.env para ver e descarregar as imagens." />
      )}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item, index) => (
            <AttachmentTile key={`${index}-${item.uploadName}`} applicationId={applicationId} item={item} index={index} showImage={portfolioConfigured} />
          ))}
        </div>
      ) : (
        <span className="text-[13px] text-text-3">A skill não escolheu prints para esta candidatura.</span>
      )}
      {missing.length > 0 && (
        <p className="m-0 text-[12.5px] text-text-3">
          Sem prints no portfólio: <span className="text-text-2">{missing.join(', ')}</span> — tira-os com{' '}
          <span className="font-mono">/capture-project-screenshots</span> no projeto do portfólio.
        </p>
      )}
    </section>
  );
}
