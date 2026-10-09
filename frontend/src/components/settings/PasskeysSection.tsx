import { KeyOutlined, PlusOutlined } from '@ant-design/icons';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { Button, Spin } from 'antd';
import { useState } from 'react';
import { formatSessionDate } from '@/components/terminals/terminalDisplay';
import { ErrorHandler } from '@/errors/errorHandler';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { usePasskeys } from '@/hooks/usePasskeys';
import * as passkeyService from '@/services/passkeyService';
import type { PasskeySummary } from '@/types/auth';
import { AddPasskeyForm } from './AddPasskeyForm';

/** Secção "Passkeys" das Definições (ADR 0015): registar neste dispositivo, listar, revogar. */
export function PasskeysSection() {
  const { logout } = useAuth();
  const confirm = useConfirm();
  const { passkeys, refresh } = usePasskeys();
  const [adding, setAdding] = useState(false);
  const supported = browserSupportsWebAuthn();

  const revoke = (passkey: PasskeySummary) =>
    confirm({
      title: 'Revogar passkey?',
      actionLabel: 'Revogar',
      message: passkey.current
        ? `"${passkey.name}" deixa de poder entrar, e esta sessão — aberta com ela — termina agora.`
        : `"${passkey.name}" deixa de poder entrar, e as sessões abertas com ela terminam agora.`,
      onConfirm: async () => {
        try {
          await passkeyService.revokePasskey(passkey.id);
        } catch (error) {
          ErrorHandler.handle(error);
          return;
        }
        // A sessão deste browser acabou no servidor: sair já, em vez de esperar pelo próximo 401.
        if (passkey.current) await logout();
        else refresh();
      },
    });

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold">Passkeys</span>
        <span className="flex-1" />
        {supported && !adding && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
            Adicionar
          </Button>
        )}
      </div>
      <span className="text-[12.5px] text-text-3">
        Entrar sem password, com o Face ID, Touch ID ou Windows Hello. A password continua a funcionar.
      </span>

      {!supported && <span className="text-[12.5px] text-text-3">Este browser não suporta passkeys.</span>}

      {adding && (
        <AddPasskeyForm
          onCancel={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}

      {passkeys === null ? (
        <Spin size="small" />
      ) : passkeys.length === 0 ? (
        <span className="text-[12.5px] text-text-3">Nenhuma passkey registada.</span>
      ) : (
        <ul className="flex flex-col gap-1.5 m-0 p-0 list-none" aria-label="Passkeys registadas">
          {passkeys.map((passkey) => (
            <li
              key={passkey.id}
              data-passkey-id={passkey.id}
              className="flex items-center gap-3 px-3 py-[9px] rounded-md border border-border"
            >
              <KeyOutlined className="text-accent flex-none" aria-hidden />
              <span className="flex flex-col gap-px flex-1 min-w-0">
                <span className="text-[13.5px] font-medium text-text-1 truncate">
                  {passkey.name}
                  {passkey.current && <span className="ml-2 text-[11.5px] font-normal text-accent">esta sessão</span>}
                </span>
                <span className="text-[12.5px] text-text-3">
                  Criada {formatSessionDate(passkey.createdAt)} · último uso{' '}
                  {passkey.lastUsedAt ? formatSessionDate(passkey.lastUsedAt) : 'nunca'}
                </span>
              </span>
              <Button type="text" size="small" danger onClick={() => revoke(passkey)}>
                Revogar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
