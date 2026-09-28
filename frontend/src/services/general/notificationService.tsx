import { notification } from 'antd';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { ApiFieldError } from '@/errors/error.types';

/*
 * Canal único de toasts. A instância vem do <App> do antd (NotificationBridge) para herdar o
 * tema; o `notification` estático só serve de recurso antes de a app montar.
 */
let instance: NotificationInstance | null = null;

export function setNotificationInstance(next: NotificationInstance) {
  instance = next;
}

const current = () => instance ?? notification;

export const notificationService = {
  success(title: string, description?: string) {
    current().success({ title, description });
  },
  info(title: string, description?: string) {
    current().info({ title, description });
  },
  warning(title: string, description?: string) {
    current().warning({ title, description });
  },
  error(title: string, description?: string) {
    current().error({ title, description });
  },
  validationError(fieldErrors: ApiFieldError[]) {
    current().error({
      title: 'Dados inválidos',
      description: (
        <ul className="m-0 pl-4">
          {fieldErrors.map(({ field, message }) => (
            <li key={field}>
              <span className="font-mono">{field}</span>: {message}
            </li>
          ))}
        </ul>
      ),
    });
  },
};
