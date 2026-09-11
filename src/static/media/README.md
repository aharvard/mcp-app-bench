# Media fixtures

## Sintel trailer

`sintel-trailer.mp4` is the unmodified Sintel trailer by the Blender Foundation / Durian Open Movie Team.

- Copyright: © Blender Foundation · https://www.sintel.org/
- License: [Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/)
- Project licensing: https://durian.blender.org/sharing/
- Source: https://media.w3.org/2010/05/sintel/trailer.mp4
- SHA-256: `b670602fa00934ca27c4351bb0efe7ea7a07fae57284e44226025eeed7c51254`

This copy retains the original credits and audio. It ships with the server so playback does not depend on a third-party media host accepting requests from embedded apps.

`pnpm build` copies this directory into `dist/static/media`. The server serves it at `/static/media` with byte-range support, public CORS, and `Cross-Origin-Resource-Policy: cross-origin`.
