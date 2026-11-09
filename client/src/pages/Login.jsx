import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Login({ setUser }) {
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const r = await api('POST', '/auth/login', { name: f.get('name'), password: f.get('password') });
    if (r.status === 200) {
      setUser(r.data);
      navigate('/');
    } else {
      setError((r.data && r.data.error) || 'Could not log in');
    }
  }

  return (
    <main>
      <h1>Log in</h1>
      <form onSubmit={submit}>
        <p><label>Name <input name="name" autoComplete="username" required /></label></p>
        <p><label>Password <input name="password" type="password" autoComplete="current-password" required /></label></p>
        {error && <p role="alert">{error}</p>}
        <p><button type="submit">Log in</button></p>
      </form>
    </main>
  );
}
