# Privacy Policy

Last updated: March 10, 2026

ImmersionKit Mining Helper is a Chrome extension that helps the user send selected example sentence data from ImmersionKit to Anki through AnkiConnect.

## TLDR

This extension sends data to immersionkit.com to fetch the audio/image, and then sends that audio/image/sentence to your AnkiConnect server. There is no other data collection.

## What the extension reads
- The selected example sentence on ImmersionKit
- Related translation/title information used to identify the correct example
- Related image and audio URLs needed to import media into Anki
- User-provided extension settings such as Anki field names, AnkiConnect URL, and latest-note query

## How the extension uses that information
- To insert a custom action button on ImmersionKit example rows
- To identify the selected example
- To download the selected example image and audio
- To send the selected sentence and media to the user's local AnkiConnect instance

## Where data is sent
- To ImmersionKit and ImmersionKit media endpoints, when needed to resolve the selected example and fetch media
- To the user's local AnkiConnect server at the configured localhost address, usually `http://127.0.0.1:8765/`

## What the extension does not do
- It does not create a remote account
- It does not send data to the developer's servers
- It does not use analytics or advertising SDKs
- It does not sell user data

## Data storage
The extension stores the following locally in Chrome extension storage:
- AnkiConnect URL
- Configured Anki field names
- Latest-note query
- Temporary debug log entries used for troubleshooting

## User control
The user controls:
- Whether to install and enable the extension
- Whether to click the import button for a specific example
- Which Anki fields are used
- Which Anki note query is used
- Whether to clear the extension debug log

## Contact
For support or privacy questions, use the support contact listed on the Chrome Web Store page for this extension.
