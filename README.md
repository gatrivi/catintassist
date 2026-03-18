Medical Interpreter Assistant App
A modern, responsive React-based web application to assist medical interpreters. The app will capture call audio directly from your browser, provide real-time transcription and translation, allow seamless note-taking, and automatically track your session time and earnings.

Core Features & Technical Choices
Audio Capture: Use the modern Web API navigator.mediaDevices.getDisplayMedia({ audio: true, video: false }). This allows the app to ask you to select a Chrome tab (the call tab) and specifically captures the audio from that tab.
Live Transcription & Translation: Since you need something very accurate, fast, and economical (to fit your $0.13/min rate), I strongly recommend Deepgram.
Deepgram's Nova-2 model excels at medical terminology, has native support for both English and Spanish, and is incredibly cheap (around $0.0043/min), which means it takes up less than 5% of your earnings.
We can either use Deepgram for both transcription and translation, or pair it with another cheap translation API.
Note-taking: A synchronized, auto-saving rich text or simple markdown area on the right side of the screen.
Time & Earnings Tracking: A dashboard header that displays a stopwatch tracking active interpretation time, instantly calculating and displaying your earnings.
