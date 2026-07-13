# @jpodivin/pi-fireplace 🔥

A cozy fireplace for the [pi coding agent](https://pi.dev) - animated flames with toggleable smoke, right in your terminal.

This is mostly an exercise in making installable package for my coding agent.
All credit for the idea should go to the creator of the original [emacs-fireplace](https://github.com/johanvts/emacs-fireplace/),
Johan Sivertsen.

## Features

- **Animated flames** — Procedural flickering flame animation with orange/dark-orange fire
- **Toggleable smoke** — Press `S` to toggle smoke particles on/off
- **Boxed firebox display** — Bordered firebox with colorful flame blocks, footer with keybinding hints
- **Lightweight** — Runs entirely in the terminal, no external dependencies

## Installation

### From npm

```console
pi install npm:@jpodivin/pi-fireplace
```

### From local path (development)

```console
pi install /absolute/path/to/pi-fireplace
pi install .  # when cwd is the package directory
```

Then type `/fireplace` in the editor.

## Usage

1. Start pi in interactive mode
2. Type `/fireplace` and press Enter
3. Enjoy the cozy fireplace animation!

### Keybindings

| Key | Action |
|-----|--------|
| `S` | Toggle smoke on/off |
| `Q` | Quit fireplace |
| `Esc` | Exit fireplace |

## Development

To test locally:

```console
pi -e ./extensions/index.ts
```

Then in the pi editor, type `/fireplace`.

To run the structural flame tests:

```console
pnpm test
# or directly:
pnpm tsx --test test.ts
```

## License

MIT
