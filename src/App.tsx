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
import { NewChat } from './components/NewChat';
import { Layout } from './components/Layout';
import { WebsiteLayout } from './components/WebsiteLayout';
import { Website } from './components/Website';
import { Features } from './components/Features';
import { Security } from './components/Security';
import { FAQ } from './components/FAQ';
import { Settings } from './components/Settings';
import { supabase, subscribeToUserThreads, subscribeToThread } from './utils/supabase/index';
import { setupAutoDeleteInterval } from './utils/supabase/autoDelete';
import './index.css';

// Add a component to initialize the auto-delete system
const AutoDeleteInitializer: React.FC = () => {
  const { user } = useUser();
  
  useEffect(() => {
    if (user) {
      // Set up the auto-delete interval when the user is authenticated
      const cleanup = setupAutoDeleteInterval(user.id);
      
      // Also sync the current user's auto-delete settings to the database
      try {
        // Check if settings exist in localStorage
        const savedSettings = localStorage.getItem('xrpchat_auto_delete_settings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          
          // Save to database asynchronously
          import('./utils/supabase/autoDelete').then(module => {
            module.saveAutoDeleteSettingsToDatabase(user.id, settings)
              .catch(error => {
                console.error('Error syncing auto-delete settings to database on startup:', error);
              });
          });
        }
      } catch (error) {
        console.error('Error processing auto-delete settings on startup:', error);
      }
      
      // Clean up the interval when the component unmounts
      return cleanup;
    }
  }, [user]);
  
  return null;
};

// Separate component for route protection logic
const RouteGuard: React.FC = () => {
  const { user, loading } = useUser();
  const location = useLocation();
  const isPublicRoute = ['/', '/signin', '/signup', '/website', '/website/signin', '/website/signup'].includes(location.pathname);
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
    return <Navigate to="/signin" replace />;
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
              <AutoDeleteInitializer />
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
      {/* Website Routes */}
      <Route path="/" element={<WebsiteLayout />}>
        <Route index element={<Website />} />
        <Route path="website" element={<Website />} />
        <Route path="website/features" element={<Features />} />
        <Route path="website/security" element={<Security />} />
        <Route path="website/faq" element={<FAQ />} />
      </Route>
      
      {/* Auth Routes - placed at root level for easier access */}
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/website/signin" element={<Navigate to="/signin" replace />} />
      <Route path="/website/signup" element={<Navigate to="/signup" replace />} />
      
      {/* Protected App Routes */}
      <Route path="/app" element={<ProtectedRoute element={<AuthenticatedLayout />} />}>
        <Route index element={<Navigate to="/app/chats" />} />
        <Route path="chats" element={<ChatList />} />
        <Route path="chat/new" element={<NewChat />} />
        <Route path="chat/:id" element={<Chat />} />
        <Route path="contacts" element={<ContactList />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      
      {/* Fallback Route */}
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
