# Music Maker

Create music using Claude Code. Or Codex.


https://github.com/user-attachments/assets/d3d78550-e19f-4011-bd9f-7123061de983


## Run

Open [index.html](/Users/manish/Downloads/music-maker/index.html) in a browser, or serve the folder with a static server if you prefer.

`python3 -m http.server`

## Features

- Ask Claude Code to give you a json by sharing a sample. And paste it.
- Download the generated audio.

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

