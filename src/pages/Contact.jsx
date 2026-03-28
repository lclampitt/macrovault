import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import '../styles/contact.css';

const FORMSPREE_URL = 'https://formspree.io/f/xreopzjn';

export default function Contact() {
  const navigate = useNavigate();
  const [form, setForm]     = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error('Something went wrong. Please try again.');
      }

      setStatus('success');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  return (
    <div className="ct-page">
      <motion.div
        className="ct-card"
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <AnimatePresence mode="wait">
          {status === 'success' ? (
            /* ── Success state ── */
            <motion.div
              key="success"
              className="ct-success"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="ct-success__icon">
                <CheckCircle size={32} />
              </div>
              <h2 className="ct-success__title">Message sent!</h2>
              <p className="ct-success__sub">
                Thanks for reaching out. We'll get back to you soon.
              </p>
              <button
                className="ct-btn ct-btn--teal"
                onClick={() => { setStatus('idle'); setForm({ name: '', email: '', message: '' }); }}
              >
                Send another
              </button>
              <button
                className="ct-btn ct-btn--ghost"
                onClick={() => navigate('/')}
              >
                <ArrowLeft size={15} /> Back to home
              </button>
            </motion.div>
          ) : (
            /* ── Form ── */
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="ct-header">
                <h1 className="ct-title">Contact Us</h1>
                <p className="ct-subtitle">
                  Have a question, feedback, or request? We'd love to hear from you.
                </p>
              </div>

              <form className="ct-fields" onSubmit={handleSubmit}>
                <div className="ct-field">
                  <label className="ct-label">Name</label>
                  <input
                    className="ct-input"
                    type="text"
                    name="name"
                    placeholder="Your name"
                    value={form.name}
                    onChange={onChange}
                    required
                  />
                </div>

                <div className="ct-field">
                  <label className="ct-label">Email</label>
                  <input
                    className="ct-input"
                    type="email"
                    name="email"
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={onChange}
                    required
                  />
                </div>

                <div className="ct-field">
                  <label className="ct-label">Message</label>
                  <textarea
                    className="ct-input ct-textarea"
                    name="message"
                    placeholder="Write your message..."
                    rows={5}
                    value={form.message}
                    onChange={onChange}
                    required
                  />
                </div>

                {status === 'error' && (
                  <div className="ct-error">
                    <AlertCircle size={14} />
                    {errorMsg}
                  </div>
                )}

                <motion.button
                  type="submit"
                  className="ct-btn ct-btn--teal"
                  disabled={status === 'sending'}
                  whileTap={{ scale: 0.97 }}
                >
                  {status === 'sending' ? (
                    'Sending…'
                  ) : (
                    <>
                      Send Message <Send size={15} />
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
