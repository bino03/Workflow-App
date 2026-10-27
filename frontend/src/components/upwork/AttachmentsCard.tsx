import { DownloadOutlined } from '@ant-design/icons';
import { Alert, Button } from 'antd';
import { CopyButton } from '@/components/common/CopyButton';
import { attachmentUrl } from '@/services/upworkService';
import type { AttachmentsView } from '@/types/upwork';

type Item = AttachmentsView['items'][number];

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
 * Os prints a anexar à proposta (ADR 0024): escolhidos pelo `/upwork-proposal` dos catálogos do portfólio. O upload na
 * Upwork é à mão — daqui descarrega-se cada imagem já com o nome que o cliente vai ver.
 */
export function AttachmentsCard({ applicationId, attachments, error }: { applicationId: string; attachments: AttachmentsView | null; error: string | null }) {
  if (error) {
    return <Alert type="warning" showIcon title="Os prints não se leram" description={<span className="font-mono text-[12px]">{error}</span>} />;
  }
  // Um pacote de antes dos prints, ou a skill ainda a escrever: nada a mostrar.
  if (!attachments) return null;
  const { items, missing, portfolioConfigured } = attachments;
  return (
    <section className="card p-4 flex flex-col gap-3" aria-label="Prints a anexar">
      <div className="flex items-center gap-2">
        <span className="text-[14px] leading-[20px] font-semibold text-text-1">Prints a anexar</span>
        <span className="text-[12px] text-text-3">para o cliente · {items.length === 1 ? '1 print' : `${items.length} prints`}</span>
        <span className="flex-1" />
        {items.length > 0 && <CopyButton text={allCaptions(items)} label="Copiar legendas" />}
      </div>
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
