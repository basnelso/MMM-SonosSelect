# MMM-SonosSelect

A [MagicMirror²](https://magicmirror.builders/) panel for choosing which Sonos rooms play music, built for touchscreen mirrors.

- One tile per room: tap an unlit room to add it to the music, tap a lit room to take it out (or pause, if it is the only one).
- Previous / play-pause / next for the group being controlled.
- Group volume, plus a volume slider per room while several rooms play together.
- Follows the group playing Spotify first, then other music. TV audio can be ignored entirely (on by default).
- Remembers the group it last followed, so Play after a pause resumes the same rooms, even when the music was
  started from another app.
- Shows volume limits set in [MMM-SonosEQ](https://github.com/basnelso/MMM-SonosEQ) as a red line on the volume
  sliders, which stop at the limit.

The node helper talks to the speakers directly on your local network (UPnP, port 1400) using the
[`sonos`](https://www.npmjs.com/package/sonos) package. Speakers are found automatically with SSDP, so no
IP addresses or separate Sonos HTTP server are needed.

## Installation

```sh
cd ~/MagicMirror/modules
git clone https://github.com/basnelso/MMM-SonosSelect
cd MMM-SonosSelect
npm install
```

The MagicMirror host must be on the same network as the speakers, with multicast (SSDP) allowed.

## Configuration

```javascript
{
    module: "MMM-SonosSelect",
    position: "top_right",
    config: {
        columns: 4,
        buttons: {
            "1": { room: "Living Room", symbol: "couch" },
            "2": { room: "Kitchen", symbol: "utensils" },
            "3": { room: "Bedroom", symbol: "bed" },
            "4": { room: "Office", label: "Study", symbol: "tv" },
        }
    }
},
```

| Option | Default | Description |
|---|---|---|
| `buttons` | two example rooms | Rooms to show, in order. `room` must match the room name in the Sonos app exactly. `symbol` is a [Font Awesome](https://fontawesome.com/icons) icon name. `label` (optional) is the text shown under the icon, if different from the room name. |
| `columns` | `4` | Number of room tiles per row. |
| `ignoreTvAudio` | `true` | Treat rooms playing TV audio (HDMI/optical) as idle, so the panel only ever controls music. |
| `updateInterval` | `3000` | How often (ms) to read the speakers' state. |
| `volumeThrottle` | `250` | Minimum time (ms) between volume commands while dragging a slider. |

Rooms that are not found on the network are shown dimmed and cannot be tapped.

## Notes

- Tapping a room when nothing is playing resumes whatever that room last had queued; start new music from the
  Sonos or Spotify app.
- Electron treats a finger drag on a range input as a scroll, so the sliders handle touch events themselves.
