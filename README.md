# Capture 3D — Recording Guide

A mobile-first web app that walks a user through recording a high-quality video of an
object so it can be reconstructed into a 3D model. It coaches the user on lighting and
framing, demonstrates each camera angle, drives the recording with on-screen and spoken
prompts, validates the result, and lets them save the clip.

## Capture flow

1. **Home** (`/`) — pick a capture mode. **Object Mode** is live; Scene Mode is coming soon.
2. **Object intro** (`/object-intro`) — an Instagram-style tutorial covering the three
   essentials: natural lighting, keeping the object in frame, and a clean background.
   Tap the right/left third to move between slides, press and hold to pause, or Skip.
3. **Record** (`/record`)
   - **Angle tutorial** — a short video + voice walkthrough for each of the four passes:
     Middle, Top, Bottom, and Detail.
   - **Recorder** — a guided landscape recording. Each angle gets ~30s with screen flash,
     haptics, and spoken cues at the transitions. The user can pause/resume, zoom, or
     **Finish** early. If the camera is blocked or unavailable, a recovery screen explains
     how to grant access and offers a retry.
   - **Quality check** — the recording is validated (orientation, resolution, duration,
     non-empty file). Failures are explained and the user is offered a retake.
   - **Preview & save** — review the scan and download it.

Recording is locked to **landscape** for consistent 3D results.

## Tech stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** with **shadcn/ui** (Radix) components
- **react-router-dom** for routing, **@tanstack/react-query** for data, **sonner** for toasts
- Browser **MediaRecorder** / **getUserMedia** for capture and the **Web Speech API** for voice prompts

## Getting started

Requires Node.js and npm.

```sh
# Install dependencies
npm install

# Start the dev server (exposed on the local network for phone testing)
npm run dev

# Type-check / lint
npm run lint

# Production build
npm run build

# Preview the production build
npm run preview
```

> The dev server is configured with HTTPS (via `vite-plugin-mkcert`) because camera
> access requires a secure context. To test on a phone, open the network URL printed
> by `npm run dev` and accept the local certificate.

## Project structure

```
src/
  pages/            Route screens (Home, ObjectIntro, RecordFlow, NotFound)
  components/
    capture/        Capture-flow UI (tutorials, countdown, permission error)
    ui/             shadcn/ui primitives
    CameraRecorder.tsx, SavePreview.tsx, OrientationLock.tsx
  utils/            autoCheck (quality validation), formatTime
  asset/            Tutorial videos and example images
```
