import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import NotesApp from './pages/NotesApp.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Account from './pages/Account.jsx'
import { fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';
import { useEffect } from 'react';
import apiService from './api/apiService.js';
import './auth/amplifyConfig.js'

const router = createBrowserRouter(
  [
    { path: '/', element: <Landing /> },
    { path: '/dashboard', element: <Dashboard /> },
    { path: '/app', element: <NotesApp /> },
    { path: '/account', element: <Account /> },
    { path: '*', element: <Landing /> }
  ],
  {
    future: {
      v7_startTransition: true
    }
  }
)

export default function App() {
  useEffect(() => {
      (async () => {
        // {
        //   sub: "user-uuid",
        //   email: "user@example.com",
        //   email_verified: true,
        //   name: "Full Name",
        //   preferred_username: "nickname",
        //   given_name: "First",
        //   family_name: "Last",
        //   // ...other Cognito attributes
        // }
        const a = await fetchUserAttributes();
        const session = await fetchAuthSession();
        const accessToken = session.tokens?.accessToken?.toString();
        localStorage.setItem('auth_access_token', accessToken);
        const checkInObject = { cognito_id: a?.sub || null,
                      cognito_token: accessToken || null,
                      email: a?.email || null,
                      display_name: `${a?.name || ''} ${a?.preferred_username || ''}`,
                      phone: a?.phone || null,
                      address: a?.address || null,
                      profile: a || null,
                    };
        const checkinResult = await apiService.checkIn(checkInObject);
        localStorage.setItem('user_id', a?.sub);
        apiService.setUserId(a?.sub);
      })().catch(console.error);
    }, []);

  
  return <RouterProvider router={router} />
}