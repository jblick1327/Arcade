// Login.jsx - login page
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import the shared name/password form
import AuthForm from './AuthForm.jsx';

//=============================================================
//                         COMPONENT
//=============================================================

// login form - on success the user is signed in and sent home
const Login = ({ setUser }) => {
  return (
    <AuthForm
      title="Log in"
      endpoint="/auth/login"
      successStatus={200}
      passwordAutoComplete="current-password"
      fallbackError="Could not log in"
      setUser={setUser}
    />
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default Login;
