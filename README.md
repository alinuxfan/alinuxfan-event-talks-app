# BigQuery Release Hub ⚡

A high-fidelity, premium web application built with Python Flask, vanilla HTML, JavaScript, and CSS that fetches and displays the Google Cloud BigQuery Release Notes in real time, and provides an interactive share-to-X (Twitter) composer.

## Features

- **Real-Time Atom Feed Aggregation**: Fetches the official Google Cloud BigQuery Release Notes feed directly and parses it into structured data.
- **Robust Local Caching**: Fast loading speeds with automatic 5-minute memory caching, backed by a physical/forced refresh system.
- **Type-Based Badges and Pills**: Dynamically scans release notes for types (`Feature`, `Issue`, `Deprecation`, etc.) and styles them with themed colors. Includes clickable filter pills to filter updates in real time.
- **Smart Text Highlighting Search**: Full-text client-side search with HTML-safe token highlighting that does not disrupt embedded HTML anchors or code formatting.
- **Premium Dark/Light Themes**: Modern developer-oriented dark theme by default, with a fast theme-toggle switch and system preference memory using local storage.
- **Mock Twitter/X Composer Modal**: Click "Tweet" on any card to open a pixel-perfect, custom-designed X Tweet Composer. 
  - Generates a polished tweet draft template with emojis, date, and link.
  - Live character limit checking (280 characters) with a circular SVG progress meter.
  - Dynamic button disabling and color highlights for character limits.
  - One-click publishing that opens X's Web Intent page prefilled with your customized tweet.
- **Responsive Layout**: Designed from scratch to render beautifully on mobile devices, tablets, and wide desktop screens.

## Quick Start

### 1. Setup Virtual Environment
Create a virtual environment and install the required packages:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Run the Application
Start the Flask dev server:

```bash
python3 app.py
```

By default, the application will run at [http://127.0.0.1:5000](http://127.0.0.1:5000).

## Project Structure

- `app.py`: Flask backend, routing, fetching Google Cloud RSS/Atom XML feed, and cache-control.
- `requirements.txt`: Python package requirements (Flask, requests, beautifulsoup4).
- `templates/index.html`: Responsive Dashboard HTML layout.
- `static/css/style.css`: Clean, vanilla CSS, variables, keyframe animations, dark/light theme, and layout components.
- `static/js/app.js`: Client-side logic for searching, filtering, feed state synchronization, and character-limited tweet composer.
