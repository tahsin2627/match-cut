import React from 'react';
import MatchCut from '../components/MatchCut';

export default function Home() {
  return (
    <div className="page-root">
      <header className="topbar">
        <div className="brand">
          <div className="logo">MC</div>
          <div className="brand-text">
            <strong>Match Cut</strong>
            <span className="sub">Text → premium clip</span>
          </div>
        </div>
        <nav className="nav">
          <button className="ghost">Templates</button>
          <button className="ghost">Docs</button>
        </nav>
      </header>

      <main className="main">
        <section className="left">
          <h1 className="headline">Turn any word into a short match-cut clip</h1>
          <p className="lead">Phone friendly. One template to start. You type, it renders. Exportable video.</p>
          <div className="features glass">
            <div className="f">
              <strong>Fixed preview</strong>
              <div className="muted">Stable 9:16 preview — consistent recording</div>
            </div>
            <div className="f">
              <strong>Unlimited text</strong>
              <div className="muted">Auto-scaling fits short or long phrases</div>
            </div>
            <div className="f">
              <strong>Phone-first</strong>
              <div className="muted">Lightweight, quick renders for 3–4s clips</div>
            </div>
          </div>
        </section>

        <section className="right">
          <div className="preview-wrap glass">
            <div className="preview-top">
              <div className="badge">Template — Sample</div>
              <div className="hint">Preview</div>
            </div>

            <div className="preview-stage">
              <MatchCut />
            </div>

            <div className="preview-footer muted">Tip: Tap Export to download a short .webm (we'll add MP4 next)</div>
          </div>
        </section>
      </main>

      <footer className="foot muted">Built for quick testing. Next: upgrade animation → MP4 export.</footer>

      <style jsx>{`
        /* layout tweaks for responsiveness */
        @media (min-width: 900px) {
          .main { display:grid; grid-template-columns: 1fr 460px; gap:28px; align-items:start; }
        }
        @media (max-width: 899px) {
          .main { display:flex; flex-direction:column; gap:18px; padding: 18px; }
          .left { padding: 0 6px; }
        }
      `}</style>
    </div>
  );
}
