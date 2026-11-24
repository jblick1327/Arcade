// Contact.jsx - contact us page with a message form
// Author: Reachnid Group
// Centennial College - Fall 2026

// There is no contact endpoint on the server yet, so the form only checks the fields and shows
// a thank-you message. When one exists: await api('POST', '/contact', { name, email, message })

//=============================================================
//                          IMPORTS
//=============================================================

// import react hooks
import { useState } from 'react';

//=============================================================
//                          SETTINGS
//=============================================================

// simple "something@something.something" email check
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//=============================================================
//                         COMPONENT
//=============================================================

// contact page - name, email and message form
const Contact = () => {
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  // check the form and show the result
  function submit(e) {
    e.preventDefault();

    // read the fields from the form
    const form = e.currentTarget;
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();

    // every field is required, and the email must look valid
    setSent(false);
    if (!name || !email || !message) {
      setError('Please fill in all fields.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError('Please enter a valid email.');
      return;
    }

    // "sent" - clear the form
    setError('');
    setSent(true);
    form.reset();
  }

  return (
    <main className="rn-root">
      <div className="rn-contact">
        <h1 className="rn-title">Contact Us</h1>
        <p className="rn-intro">Have a question or feedback? Send us a message.</p>

        <form className="rn-form" onSubmit={submit} noValidate>
          {/* name & email side by side */}
          <div className="rn-form-row">
            <div className="rn-field">
              <label htmlFor="contact-name">Name</label>
              <input id="contact-name" name="name" type="text" autoComplete="name" />
            </div>
            <div className="rn-field">
              <label htmlFor="contact-email">Email</label>
              <input id="contact-email" name="email" type="email" autoComplete="email" />
            </div>
          </div>

          {/* message */}
          <div className="rn-field rn-field-message">
            <label htmlFor="contact-message">Message</label>
            <textarea id="contact-message" name="message" />
          </div>

          <button type="submit" className="rn-send">
            Send Message
          </button>

          {/* result */}
          {error && (
            <p role="alert" className="rn-status rn-status-error">
              {error}
            </p>
          )}
          {sent && (
            <p role="status" className="rn-status">
              Thanks! Your message has been sent.
            </p>
          )}
        </form>
      </div>
    </main>
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default Contact;
