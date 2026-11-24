// Register.jsx - register page
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

// register form - on success the new account is signed in and sent home
const Register = ({ setUser }) => {
  return (
    <AuthForm
      title="Register"
      endpoint="/auth/register"
      successStatus={201}
      passwordAutoComplete="new-password"
      fallbackError="Could not register"
      setUser={setUser}
    />
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default Register;
