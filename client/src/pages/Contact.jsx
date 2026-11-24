import { useState } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Contact() {
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();

    setSent(false);
    if (!name || !email || !message) {
      setError('Please fill in all fields.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError('Please enter a valid email.');
      return;
    }

    // TODO (backend): there is no contact endpoint yet. When one exists:
    //   const r = await api('POST', '/contact', { name, email, message });
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

          <div className="rn-field rn-field-message">
            <label htmlFor="contact-message">Message</label>
            <textarea id="contact-message" name="message" />
          </div>

          <button type="submit" className="rn-send">
            Send Message
          </button>

          {error && <p role="alert" className="rn-status rn-status-error">{error}</p>}
          {sent && <p role="status" className="rn-status">Thanks! Your message has been sent.</p>}
        </form>
      </div>
    </main>
  );
}
