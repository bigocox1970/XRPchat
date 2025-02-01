import React from 'react';
import { 
  createBrowserRouter,
  RouterProvider,
  Navigate,
  createRoutesFromElements,
  Route,
  useLocation,
  Outlet
} from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
import { EncryptionProvider } from './context/EncryptionContext';
import { DarkModeProvider } from './context/DarkModeContext';
import { EncryptionModeProvider } from './context/EncryptionModeContext';
import { DebugModeProvider } from './context/DebugModeContext';
import { SignUp } from './components/SignUp';
import { SignIn } from './components/SignIn';
import { Profile } from './components/Profile';
import { ContactList } from './components/ContactList';
import { ChatList } from './components/ChatList';
import { Chat } from './components/Chat';
import { Layout } from './components/Layout';
import { WebsiteLayout } from './components/WebsiteLayout';
import { Website } from './components/Website';
import { Features } from './components/Features';
import { Security } from './components/Security';
import { FAQ } from './components/FAQ';

// Separate component for route protection logic
const RouteGuard: React.FC = () => {
  const { user, loading } = useUser();
  const location = useLocation();
  const isPublicRoute = ['/website/signup', '/website/signin'].includes(location.pathname);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user && !isPublicRoute) {
    return <Navigate to="/website/signin" replace />;
  }

  if (user && isPublicRoute) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
};

// Wrap the entire app with providers
const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DarkModeProvider>
      <DebugModeProvider>
        <UserProvider>
          <EncryptionModeProvider>
            {children}
          </EncryptionModeProvider>
        </UserProvider>
      </DebugModeProvider>
    </DarkModeProvider>
  );
};

// Layout wrapper for authenticated routes
const AuthenticatedLayout: React.FC = () => {
  const location = useLocation();
  const isAuthRoute = ['/website/signup', '/website/signin'].includes(location.pathname);

  if (isAuthRoute) {
    return <Outlet />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

// Website routes wrapper
const WebsiteLayoutWrapper: React.FC = () => {
  return (
    <WebsiteLayout>
      <Outlet />
    </WebsiteLayout>
  );
};

// Main routes configuration
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      {/* Website Routes */}
      <Route element={<WebsiteLayoutWrapper />}>
        <Route path="/website" element={<Website />} />
        <Route path="/website/features" element={<Features />} />
        <Route path="/website/security" element={<Security />} />
        <Route path="/website/faq" element={<FAQ />} />
      </Route>

      {/* Auth & App Routes */}
      <Route element={<RouteGuard />}>
        <Route path="/website/signup" element={<SignUp />} />
        <Route path="/website/signin" element={<SignIn />} />
        <Route path="/app" element={<AuthenticatedLayout />}>
          <Route index element={<ChatList />} />
          <Route path="profile" element={<Profile />} />
          <Route path="contacts" element={<ContactList />} />
          <Route path="chat/new" element={<ContactList />} />
          <Route path="chat/:threadId" element={<Chat />} />
        </Route>
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/website" replace />} />
    </Route>
  )
);

const App: React.FC = () => {
  return (
    <AppProviders>
      <EncryptionProvider>
        <RouterProvider router={router} />
      </EncryptionProvider>
    </AppProviders>
  );
};

export default App;
