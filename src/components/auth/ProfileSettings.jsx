// src/components/ProfileSettings.jsx
import { useEffect, useState } from 'react';
import {
  fetchUserAttributes,
  updateUserAttributes,
  confirmUserAttribute,
  resendSignUpCode,
} from 'aws-amplify/auth';

export default function ProfileSettings() {
  const [attrs, setAttrs] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const a = await fetchUserAttributes(); // { email, name, given_name, preferred_username, ... }
      setAttrs(a);
      setDisplayName(a.preferred_username || '');
      setFullName(a.name || '');
      setEmail(a.email || '');
    })().catch(console.error);
  }, []);

  const saveProfile = async () => {
    setMsg('');
    try {
      await updateUserAttributes({
        userAttributes: {
          // Choose which one your UI treats as “user name”:
          preferred_username: displayName, // good for a handle/nickname
          name: fullName,                  // good for a full name
        },
      });
      setMsg('Profile updated.');
    } catch (e) {
      setMsg(e.message || String(e));
    }
  };

  const saveEmail = async () => {
    setMsg('');
    try {
      await updateUserAttributes({
        userAttributes: { email },
      });
      // Cognito sends a verification code to the new email
      setVerifyingEmail(true);
      setMsg('Verification code sent to your new email.');
    } catch (e) {
      setMsg(e.message || String(e));
    }
  };

  const confirmEmail = async () => {
    setMsg('');
    try {
      await confirmUserAttribute({
        userAttributeKey: 'email',
        confirmationCode: code.trim(),
      });
      setVerifyingEmail(false);
      setCode('');
      setMsg('Email verified.');
    } catch (e) {
      setMsg(e.message || String(e));
    }
  };

  const resendCode = async () => {
    setMsg('');
    try {
      await resendSignUpCode({ userAttributeKey: 'email' });
      setMsg('A new verification code was sent.');
    } catch (e) {
      setMsg(e.message || String(e));
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border p-4">
        <h3 className="font-semibold mb-2">Profile</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Display name (preferred_username)</label>
            <input className="mt-1 w-full border rounded px-3 py-2"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. janedoe" />
          </div>
          <div>
            <label className="text-sm">Full name (name)</label>
            <input className="mt-1 w-full border rounded px-3 py-2"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Jane Doe" />
          </div>
        </div>
        <button onClick={saveProfile} className="mt-3 px-3 py-1.5 border rounded">Save profile</button>
      </section>

      <section className="rounded-xl border p-4">
        <h3 className="font-semibold mb-2">Email</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Email</label>
            <input className="mt-1 w-full border rounded px-3 py-2"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        {!verifyingEmail ? (
          <button onClick={saveEmail} className="mt-3 px-3 py-1.5 border rounded">Update email</button>
        ) : (
          <div className="mt-3">
            <label className="text-sm">Verification code</label>
            <div className="flex gap-2 mt-1">
              <input className="flex-1 border rounded px-3 py-2"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Enter code" />
              <button className="px-3 py-1.5 border rounded" onClick={confirmEmail}>Confirm</button>
              <button className="px-3 py-1.5 border rounded" onClick={resendCode}>Resend</button>
            </div>
          </div>
        )}
      </section>

      {msg && <div className="text-sm text-gray-700">{msg}</div>}
    </div>
  );
}
