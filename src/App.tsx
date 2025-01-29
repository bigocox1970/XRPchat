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

// Separate component for route protection logic
const RouteGuard: React.FC = () => {
  const { user, loading } = useUser();
  const location = useLocation();
  const isPublicRoute = ['/signup', '/signin'].includes(location.pathname);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user && !isPublicRoute) {
    return <Navigate to="/signin" replace />;
  }

  if (user && isPublicRoute) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

// Wrap the entire app with providers
const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DarkModeProvider>
      <EncryptionModeProvider>
        <DebugModeProvider>
          <UserProvider>
            <EncryptionProvider>
              {children}
            </EncryptionProvider>
          </UserProvider>
        </DebugModeProvider>
      </EncryptionModeProvider>
    </DarkModeProvider>
  );
};

// Layout wrapper for authenticated routes
const AuthenticatedLayout: React.FC = () => {
  const location = useLocation();
  const isAuthRoute = ['/signup', '/signin'].includes(location.pathname);

  if (isAuthRoute) {
    return <Outlet />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

// Main routes configuration
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RouteGuard />}>
      <Route path="/signup" element={<SignUp />} />
      <Route path="/signin" element={<SignIn />} />
      <Route element={<AuthenticatedLayout />}>
        <Route path="/" element={<ChatList />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/contacts" element={<ContactList />} />
        <Route path="/chat/new" element={<ContactList />} />
        <Route path="/chat/:threadId" element={<Chat />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Route>
  )
);

const App: React.FC = () => {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
};

export default App;
