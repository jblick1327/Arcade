// AuthForm.jsx - name/password form shared by the login and register pages
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import react hooks & the router
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// import the API helper
import { api } from '../api.js';

//=============================================================
//                         COMPONENT
//=============================================================

// props:
//   title                - heading and submit-button text
//   endpoint             - API path to POST { name, password } to
//   successStatus        - HTTP status that means success (200 login, 201 register)
//   passwordAutoComplete - 'current-password' or 'new-password'
//   fallbackError        - shown when the server gives no error message
//   setUser              - receives the signed-in user on success
const AuthForm = ({
  title,
  endpoint,
  successStatus,
  passwordAutoComplete,
  fallbackError,
  setUser,
}) => {
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // send the form to the server
  async function submit(e) {
    e.preventDefault();

    // read the name & password from the form
    const form = new FormData(e.target);
    const r = await api('POST', endpoint, {
      name: form.get('name'),
      password: form.get('password'),
    });

    // signed in - go to the home page, otherwise show the error
    if (r.status === successStatus) {
      setUser(r.data);
      navigate('/');
    } else {
      setError(r.data?.error || fallbackError);
    }
  }

  return (
    <main>
      <h1>{title}</h1>
      <form onSubmit={submit}>
        <p>
          <label>
            Name <input name="name" autoComplete="username" required />
          </label>
        </p>
        <p>
          <label>
            Password{' '}
            <input name="password" type="password" autoComplete={passwordAutoComplete} required />
          </label>
        </p>
        {error && <p role="alert">{error}</p>}
        <p>
          <button type="submit">{title}</button>
        </p>
      </form>
    </main>
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default AuthForm;
