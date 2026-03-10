# Chrome Web Store Submission

## Listing

### Name
ImmersionKit Mining Helper

### Short Description
Add an ImmersionKit example sentence, image, and audio to your latest matching Anki note.

### Detailed Description
ImmersionKit Mining Helper adds a button next to example sentences on ImmersionKit and sends the selected sentence, image, and audio to Anki through AnkiConnect.

Use it when mining example sentences from ImmersionKit into an existing Anki workflow.

Features:
- Adds an `Add to latest Anki card` button to ImmersionKit example rows
- Sends the selected sentence text to a configurable Anki field
- Stores the example image in Anki media and inserts it into a configurable field
- Stores the example audio in Anki media and inserts it into a configurable field
- Lets you configure the AnkiConnect URL, field names, and latest-note query
- Works on direct dictionary URLs and ImmersionKit's in-app search navigation

Requirements:
- Anki must be installed and running
- The AnkiConnect add-on must be installed and listening on `http://127.0.0.1:8765/`

This extension only runs on ImmersionKit pages and only sends the data needed to update the selected Anki note.

## Single Purpose
Adds the selected ImmersionKit example sentence, image, and audio to the user's latest matching Anki note through AnkiConnect.

## Permissions Explanation

### Why it needs site access
- `immersionkit.com` / `www.immersionkit.com`
  - To add the mining button to example rows
  - To read the selected sentence, title, image, and related media data from the current ImmersionKit page

### Why it needs localhost access
- `http://127.0.0.1/*`
  - To communicate with the user's local AnkiConnect instance

### Why it needs storage
- To save the user's AnkiConnect URL, field mapping, latest-note query, and debug log entries

## Privacy Disclosures

### Data used
- Selected example sentence text from ImmersionKit
- Selected example translation/title when needed for matching
- Selected example image and audio URLs
- User-configured Anki field names and latest-note query

### Data destination
- Requests to ImmersionKit and its media endpoints
- Requests to the user's local AnkiConnect server on `127.0.0.1`

### Data collection statement
- No analytics
- No advertising
- No sale of data
- No remote account system
- No data is intentionally sent to the developer's servers

## Reviewer Notes
This extension depends on local Anki software.

Core test flow:
1. Install and open Anki.
2. Install the AnkiConnect add-on.
3. Open `https://www.immersionkit.com/dictionary?keyword=天気`
4. Click `Add to latest Anki card` next to an example.
5. The extension updates the latest matching Anki note using the configured fields.

Default assumptions:
- AnkiConnect URL: `http://127.0.0.1:8765/`
- Default latest note query: `added:1`

Without Anki/AnkiConnect, the extension UI still loads, but the main action will fail because the required local dependency is missing.

## Suggested Category
Productivity

## Suggested Support Email
Use the same publisher/support email you already use for your existing Chrome Web Store items.

## Suggested Screenshots
1. ImmersionKit search results page showing the injected `Add to latest Anki card` button
2. Extension options page showing configurable Anki fields
3. Anki note after import with sentence, image, and audio attached
