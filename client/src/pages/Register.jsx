import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Register({ setUser }) {
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const r = await api('POST', '/auth/register', { name: f.get('name'), password: f.get('password') });
    if (r.status === 201) {
      setUser(r.data);
      navigate('/');
    } else {
      setError((r.data && r.data.error) || 'Could not register');
    }
  }

  return (
    <main>
      <h1>Register</h1>
      <form onSubmit={submit}>
        <p><label>Name <input name="name" autoComplete="username" required /></label></p>
        <p><label>Password <input name="password" type="password" autoComplete="new-password" required /></label></p>
        {error && <p role="alert">{error}</p>}
        <p><button type="submit">Register</button></p>
      </form>
    </main>
  );
}
