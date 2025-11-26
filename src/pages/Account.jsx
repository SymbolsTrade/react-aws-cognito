// src/pages/Account.jsx
import { Authenticator, AccountSettings, Card } from '@aws-amplify/ui-react';
import ProfileSettings from '../components/auth/ProfileSettings.jsx';
import '@aws-amplify/ui-react/styles.css';

export default function Account() {
  return (
    <Authenticator>
      {({ user, signOut }) => (
          <main style={{ maxWidth: 720, margin: '2rem auto' }}>
            <h1 className="text-xl font-semibold mb-3">Account settings</h1>
            <div className="text-sm text-gray-600 mb-4">
                Signed in as <strong>{user?.username ?? user?.userId}</strong>
            </div>
            <ProfileSettings />
          {/* One-click password change flow */}
          <AccountSettings.ChangePassword
            onSuccess={() => alert('Password updated')}
            onError={(err) => alert(err.message)}
          />
          
          <button onClick={signOut} style={{ marginTop: 16 }}>
            Sign out
          </button>
        </main>
      )}
    </Authenticator>
  );
}
