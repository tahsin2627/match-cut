import React from 'react';
import MatchCut from '../components/MatchCut';

export default function Home() {
  return (
    <div className="page">
      <main className="container">
        <h1 className="title">Match Cut — text generator</h1>
        <p className="subtitle">Type any word or phrase. Preview → Export (3.2s)</p>
        <MatchCut />
        <footer className="footer">
          <small>Built for phone + Vercel. Exports .webm (downloadable).</small>
        </footer>
      </main>
    </div>
  );
}
