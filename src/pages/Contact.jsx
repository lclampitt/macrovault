import React from 'react';
import '../styles/contact.css';

export default function Contact() {
  return (
    <div className="contact-page">
      <div className="contact-card">

        <h1 className="contact-title">Contact Us</h1>
        <p className="contact-subtitle">
          Have a question, feedback, or request? Send us a message.
        </p>

        <form
          className="contact-form"
          onSubmit={(e) => {
            e.preventDefault();
            alert('Message sent! (dummy form)');
          }}
        >
          <label className="contact-label">Name</label>
          <input
            type="text"
            className="contact-input"
            placeholder="Your name"
            required
          />

          <label className="contact-label">Email</label>
          <input
            type="email"
            className="contact-input"
            placeholder="your@email.com"
            required
          />

          <label className="contact-label">Message</label>
          <textarea
            className="contact-textarea"
            placeholder="Write your message..."
            rows={6}
            required
          ></textarea>

          <button type="submit" className="contact-submit">
            Send Message
          </button>
        </form>
      </div>
    </div>
  );
}
