import os
import re
import time
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Constants
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "feed_cache.json"
CACHE_DURATION = 300  # 5 minutes in seconds

# Memory cache as fallback
_cache = {
    "data": None,
    "last_fetched": 0
}

def clean_html_content(content_html):
    """
    Cleans and standardizes the HTML content.
    Makes links open in new tabs, and ensures class names are available for styling.
    """
    if not content_html:
        return ""
    soup = BeautifulSoup(content_html, 'html.parser')
    for a in soup.find_all('a'):
        a['target'] = '_blank'
        a['rel'] = 'noopener noreferrer'
        a['class'] = 'release-link'
    return str(soup)

def parse_release_notes(xml_data):
    """
    Parses the Atom XML feed data and extracts structured release notes.
    """
    root = ET.fromstring(xml_data)
    
    # Atom namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    release_items = []
    
    for entry in root.findall('atom:entry', ns):
        # Extract metadata
        entry_title = entry.find('atom:title', ns).text or ""  # e.g., "June 15, 2026"
        entry_updated = entry.find('atom:updated', ns).text or ""
        entry_id = entry.find('atom:id', ns).text or ""
        
        # Link
        link_elem = entry.find("atom:link[@rel='alternate']", ns)
        if link_elem is None:
            link_elem = entry.find("atom:link", ns)
        entry_link = link_elem.attrib.get('href', '') if link_elem is not None else ""
        
        # Date ISO conversion for sorting
        # Format: 2026-06-15T00:00:00-07:00 -> 2026-06-15
        date_iso = entry_updated[:10] if len(entry_updated) >= 10 else ""
        
        content_elem = entry.find('atom:content', ns)
        if content_elem is None or not content_elem.text:
            continue
            
        content_html = content_elem.text
        soup = BeautifulSoup(content_html, 'html.parser')
        
        # Look for headers (<h3>) which typically group changes
        headers = soup.find_all('h3')
        
        if not headers:
            # If no <h3> header is found, treat the entire entry as a single "General" note
            text_content = soup.get_text().strip()
            # Clean up whitespace
            text_content = re.sub(r'\s+', ' ', text_content)
            
            cleaned_html = clean_html_content(content_html)
            
            release_items.append({
                "id": f"{entry_id}_0",
                "date": entry_title,
                "date_iso": date_iso,
                "type": "General",
                "content_html": cleaned_html,
                "text_content": text_content,
                "link": entry_link
            })
        else:
            # Parse individual items based on <h3> headers
            for idx, h3 in enumerate(headers):
                update_type = h3.get_text().strip()
                
                # Gather sibling tags until next <h3>
                sibling_content = []
                curr = h3.next_sibling
                while curr and (curr.name != 'h3' if hasattr(curr, 'name') else True):
                    if hasattr(curr, 'name') and curr.name:
                        sibling_content.append(str(curr))
                    elif not hasattr(curr, 'name') and isinstance(curr, str):
                        # Text node
                        sibling_content.append(curr)
                    curr = curr.next_sibling
                
                sibling_html = ''.join(sibling_content).strip()
                
                # Extract clean text representation
                sibling_soup = BeautifulSoup(sibling_html, 'html.parser')
                text_content = sibling_soup.get_text().strip()
                text_content = re.sub(r'\s+', ' ', text_content)
                
                cleaned_html = clean_html_content(sibling_html)
                
                # Generate unique ID for this specific note
                note_id = f"{entry_id}_{idx}_{update_type.lower()}"
                
                release_items.append({
                    "id": note_id,
                    "date": entry_title,
                    "date_iso": date_iso,
                    "type": update_type,
                    "content_html": cleaned_html,
                    "text_content": text_content,
                    "link": f"{entry_link}#{entry_title.replace(' ', '_')}" if entry_link else ""
                })
                
    return release_items

def fetch_feed_data(force=False):
    """
    Fetches XML feed, using memory cache if available and not expired.
    """
    global _cache
    now = time.time()
    
    if not force and _cache["data"] is not None and (now - _cache["last_fetched"]) < CACHE_DURATION:
        return _cache["data"], _cache["last_fetched"], "cache"
        
    try:
        # Fetch the feed
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Parse XML
        items = parse_release_notes(response.content)
        
        # Sort items: latest first
        items.sort(key=lambda x: (x['date_iso'], x['id']), reverse=True)
        
        # Update cache
        _cache["data"] = items
        _cache["last_fetched"] = now
        
        return items, now, "network"
    except Exception as e:
        print(f"Error fetching or parsing feed: {e}")
        # Return stale cache if available
        if _cache["data"] is not None:
            return _cache["data"], _cache["last_fetched"], "stale_cache"
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        releases, last_fetched, source = fetch_feed_data(force=force_refresh)
        return jsonify({
            "success": True,
            "count": len(releases),
            "last_fetched": last_fetched,
            "source": source,
            "releases": releases
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    # Bind to 0.0.0.0 so it is accessible inside containers or local network if needed
    app.run(host='0.0.0.0', port=5000, debug=True)
