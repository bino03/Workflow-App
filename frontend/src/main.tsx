import { StyleProvider } from '@ant-design/cssinjs';
import { App as AntApp, ConfigProvider } from 'antd';
import ptPT from 'antd/locale/pt_PT';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { PrivateRoute } from '@/components/PrivateRoute';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';
import { AppLayout } from '@/layouts/AppLayout';
import { LibraryPage } from '@/pages/LibraryPage';
import { LoginPage } from '@/pages/login/LoginPage';
import { TerminalsPage } from '@/pages/TerminalsPage';
import { NotificationBridge } from '@/services/general/NotificationBridge';
import { theme } from '@/theme';
import './index.css';

// Fora do bundle de produção: o import só existe quando DEV é true.
const TokenPreviewPage = import.meta.env.DEV ? lazy(() => import('@/pages/dev/TokenPreviewPage')) : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyleProvider layer>
      <ConfigProvider theme={theme} locale={ptPT}>
        <AntApp className="h-full">
          <NotificationBridge />
          <BrowserRouter>
            <AuthProvider>
              <ConfirmDialogProvider>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  {TokenPreviewPage && (
                    <Route path="/_tokens" element={<Suspense><TokenPreviewPage /></Suspense>} />
                  )}
                  <Route
                    element={
                      <PrivateRoute>
                        <AppLayout />
                      </PrivateRoute>
                    }
                  >
                    <Route path="/terminals" element={<TerminalsPage />} />
                    <Route path="/library" element={<LibraryPage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/terminals" replace />} />
                </Routes>
              </ConfirmDialogProvider>
            </AuthProvider>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </StyleProvider>
  </StrictMode>,
);
