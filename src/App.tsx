import React, { useEffect } from 'react';
import { 
  createBrowserRouter,
  RouterProvider,
  Navigate,
  createRoutesFromElements,
  Route,
  useLocation,
  Outlet,
  Routes
} from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
import { EncryptionProvider } from './context/EncryptionContext';
import { DarkModeProvider } from './context/DarkModeContext';
import { EncryptionModeProvider } from './context/EncryptionModeContext';
import { DebugModeProvider } from './context/DebugModeContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
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
import { supabase, subscribeToUserThreads, subscribeToThread } from './utils/supabase/index';
import './index.css';

// Separate component for route protection logic
const RouteGuard: React.FC = () => {
  const { user, loading } = useUser();
  const location = useLocation();
  const isPublicRoute = ['/', '/website/signup', '/website/signin'].includes(location.pathname);
  const isWebsiteRoute = location.pathname === '/' || location.pathname.startsWith('/website');
  const isAppRoute = location.pathname.startsWith('/app');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  // Require authentication only for app routes
  if (!user && isAppRoute) {
    return <Navigate to="/website/signin" replace />;
  }

  // Redirect authenticated users trying to access auth pages
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
          <NotificationProvider>
            <EncryptionModeProvider>
              {children}
            </EncryptionModeProvider>
          </NotificationProvider>
        </UserProvider>
      </DebugModeProvider>
    </DarkModeProvider>
  );
};

// Layout wrapper for authenticated routes
const AuthenticatedLayout: React.FC = () => {
  return (
    <Layout />
  );
};

const ProtectedRoute: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  const { user } = useUser();

  // If not authenticated, redirect to sign in
  if (!user) {
    return <Navigate to="/signin" />;
  }
  
  // If authenticated, render the protected route
  return <>{element}</>;
};

// Change from a component to a function that returns routes
const createAppRoutes = () => {
  return (
    <>
      <Route path="/" element={<WebsiteLayout />}>
        <Route index element={<Website />} />
        <Route path="signin" element={<SignIn />} />
        <Route path="signup" element={<SignUp />} />
      </Route>
      <Route path="/app" element={<ProtectedRoute element={<AuthenticatedLayout />} />}>
        <Route index element={<Navigate to="/app/chats" />} />
        <Route path="chats" element={<ChatList />} />
        <Route path="chat/:id" element={<Chat />} />
        <Route path="contacts" element={<ContactList />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </>
  );
};

const App: React.FC = () => {
  return (
    <AppProviders>
      <EncryptionProvider>
        <RouterProvider router={createBrowserRouter(createRoutesFromElements(
          createAppRoutes()
        ))} />
      </EncryptionProvider>
    </AppProviders>
  );
};

export default App;
