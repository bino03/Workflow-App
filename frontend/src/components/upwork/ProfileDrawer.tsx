import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Drawer, Input, Space } from 'antd';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FieldError } from '@/components/common/FieldError';
import { DRAWER_WIDTH } from '@/config/drawer';
import { ErrorHandler } from '@/errors/errorHandler';
import { notificationService } from '@/services/general/notificationService';
import { saveProfile } from '@/services/upworkService';
import type { ProfileView } from '@/types/upwork';
import { profileFormSchema, type ProfileFormValues } from './upworkFormSchemas';

type ProfileDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** O perfil gravado, ou o modelo inicial (`updatedAt: null`) quando ainda não há. */
  profile: ProfileView | null;
  onSaved: (profile: ProfileView) => void;
};

/**
 * O perfil de freelancer que o `/upwork-proposal` lê (ADR 0022): Markdown em `DATA_DIR/upwork/profile.md`, fora
 * dos repositórios. Cada candidatura nova leva uma cópia do que estiver gravado nesse momento.
 */
export function ProfileDrawer({ open, onClose, profile, onSaved }: ProfileDrawerProps) {
  const saved = { markdown: profile?.markdown ?? '' };
  // `values` mantém o formulário igual ao perfil carregado; o que se escreveu e não se gravou perde-se ao fechar.
  const form = useForm<ProfileFormValues>({ resolver: zodResolver(profileFormSchema), mode: 'onChange', values: saved });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty, isSubmitting },
  } = form;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isTemplate = profile !== null && profile.updatedAt === null;

  // Todo o fecho passa por aqui (Cancelar, ✕, Esc, máscara, sucesso) — forms-and-validation §4.1.
  const close = () => {
    reset(saved);
    setSubmitError(null);
    onClose();
  };

  const onSubmit = async (values: ProfileFormValues) => {
    setSubmitError(null);
    try {
      const updated = await saveProfile(values.markdown);
      notificationService.success('Perfil gravado', 'As próximas candidaturas usam esta versão.');
      onSaved(updated);
      onClose();
    } catch (e) {
      ErrorHandler.handle(e, { showNotification: false });
      setSubmitError(ErrorHandler.getMessage(e));
    }
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      size={DRAWER_WIDTH.medium}
      extra={<span className="kbd">Esc</span>}
      title={
        <div className="flex flex-col gap-1">
          <h6 className="kicker m-0">Upwork</h6>
          <h2 className="m-0 text-[20px] leading-[26px] font-semibold text-text-1">Perfil</h2>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-3">Fica só nesta máquina — nunca vai para a Upwork</span>
          <span className="flex-1" />
          <Space>
            <Button onClick={close} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="primary"
              loading={isSubmitting}
              // O modelo inicial pode gravar-se tal como está; um perfil gravado só quando mudou.
              disabled={!isValid || (!isDirty && !isTemplate)}
              onClick={() => void handleSubmit(onSubmit)()}
            >
              Gravar
            </Button>
          </Space>
        </div>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()} noValidate>
        <p className="m-0 text-[13.5px] leading-[21px] text-text-2">
          É daqui que a skill tira a prova para as cartas: quem és, o que já fizeste e com que links, o tom, e o que
          nunca prometer. Nada que não esteja aqui (ou nos projetos do Workflow) entra numa carta.
        </p>
        {isTemplate && (
          <Alert type="info" showIcon title="Ainda não tens perfil" description="Este é o modelo inicial — substitui cada secção pelo teu e grava." />
        )}
        <div className="flex flex-col">
          <label htmlFor="upwork-profile" className="text-[12.5px] text-text-3 mb-1.5">
            Perfil (Markdown)
          </label>
          <Controller
            name="markdown"
            control={control}
            render={({ field }) => (
              <Input.TextArea
                {...field}
                id="upwork-profile"
                className="font-mono text-[12.5px]"
                disabled={isSubmitting}
                autoSize={{ minRows: 18, maxRows: 32 }}
                maxLength={20_000}
                status={errors.markdown ? 'error' : undefined}
                aria-describedby="upwork-profile-error"
              />
            )}
          />
          <FieldError id="upwork-profile-error" name="markdown" errors={errors} />
        </div>
        {submitError && <Alert type="error" showIcon title={submitError} />}
      </form>
    </Drawer>
  );
}
