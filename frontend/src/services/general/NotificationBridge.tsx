import { App } from 'antd';
import { useEffect } from 'react';
import { setNotificationInstance } from './notificationService';

/** Liga o notificationService à instância do <App> do antd (herda tema e locale). */
export function NotificationBridge() {
  const { notification } = App.useApp();
  useEffect(() => setNotificationInstance(notification), [notification]);
  return null;
}
