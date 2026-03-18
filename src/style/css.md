:root {
--bg: #0f1115;
--panel: #1a1d24;
--text: #f4f1e6;
--muted: #c6c1b5;
--accent: #e0b66b;
--accent-strong: #f4c978;
--border: #2a2f3a;
--shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
font-family: "IBM Plex Mono", "Courier New", monospace;
}

- {
  box-sizing: border-box;
  }

body {
margin: 0;
min-height: 100vh;
background: radial-gradient(circle at 20% 20%, #131722, var(--bg) 45%);
color: var(--text);
display: flex;
justify-content: center;
align-items: center;
padding: 24px;
}

.app {
width: min(720px, 90vw);
background: var(--panel);
border: 1px solid var(--border);
box-shadow: var(--shadow);
padding: 24px 28px;
letter-spacing: 0.02em;
line-height: 1.6;
border-radius: 10px;
}

h1,
h2,
h3 {
margin: 0 0 12px;
font-weight: 600;
color: var(--accent-strong);
letter-spacing: 0.08em;
text-transform: uppercase;
}

p {
margin: 0 0 12px;
color: var(--muted);
}

button {
font: inherit;
background: transparent;
color: var(--text);
border: 1px solid var(--border);
padding: 10px 16px;
border-radius: 6px;
cursor: pointer;
letter-spacing: 0.08em;
transition: border-color 150ms ease, color 150ms ease, transform 120ms ease;
}

button:hover {
border-color: var(--accent);
color: var(--accent-strong);
}

button:active {
transform: translateY(1px);
}

input,
textarea {
width: 100%;
background: #0f131c;
color: var(--text);
border: 1px solid var(--border);
padding: 10px 12px;
border-radius: 6px;
font: inherit;
letter-spacing: 0.02em;
}

input:focus,
textarea:focus {
outline: 1px solid var(--accent);
box-shadow: 0 0 0 2px rgba(224, 182, 107, 0.12);
}

hr {
border: none;
border-top: 1px dashed var(--border);
margin: 16px 0;
}
