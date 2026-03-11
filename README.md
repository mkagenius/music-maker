# Music Maker
<img width="1522" height="960" alt="image" src="https://github.com/user-attachments/assets/68aa96ab-bdc3-42a4-9f33-b13fa942ba27" />

A small browser sequencer inspired by Chrome Music Lab Song Maker, but driven by JSON.

## Run

Open [index.html](/Users/manish/Downloads/music-maker/index.html) in a browser, or serve the folder with a static server if you prefer.

## Features

- Song Maker-style melody and drum grid
- Paste or upload JSON songs
- Click-to-edit melody notes and drum hits
- Built-in Web Audio playback
- Live recording with downloadable audio export
- Export the current pattern back to JSON

## JSON shape

```json
{
  "title": "Neon Steps",
  "tempo": 120,
  "steps": 8,
  "rows": [
    { "note": "E5", "color": "#ef5c70" },
    { "note": "D5", "color": "#ff8666" },
    { "note": "C5", "color": "#ffb347" },
    { "note": "A4", "color": "#e3d93f" },
    { "note": "G4", "color": "#96c63b" },
    { "note": "E4", "color": "#1eb787" },
    { "note": "D4", "color": "#18a3d7" },
    { "note": "C4", "color": "#6982f5" }
  ],
  "notes": [
    { "step": 0, "note": "G4", "length": 2 },
    { "step": 2, "note": "A4", "length": 2 }
  ],
  "drums": [
    { "step": 2, "lane": "kick" },
    { "step": 4, "lane": "snare" },
    { "step": 7, "lane": "hat" }
  ]
}
```

`notes` can use either `note` or `row`.

## Audio download

Use `Record` to capture playback from the start of the pattern, then `Stop Rec` to finish and download the audio. The downloaded format depends on the browser and is usually `webm`.
