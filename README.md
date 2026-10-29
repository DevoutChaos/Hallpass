# Hallpass

An offline classroom pass tracker. Children tap their name to go out and tap it again when they come back. Hallpass logs who left, when, and for how long.

- Works fully offline once installed. No accounts, no internet needed.
- Shares nothing. Names and history are stored only in the browser on each device.
- Runs on Android phones and tablets, iPad, and Windows (e.g. Galaxy Book) as an installable web app.

## Features

- **Class screen.** Shows the class list on the left and children who are out on the right (stacked on phones). It plays a ding when a child leaves or returns and an error sound when a tap is refused.
- **Limits per class list.** Defaults: 2 boys and 2 girls out at once, 4 in total, and a child can't go out again within 45 minutes of last leaving. Leave a limit blank for no limit, or set the wait to 0 to turn it off.
- **Several class lists.** List names must be different from each other. A child's name must be unique within its list but can appear on other lists. Boy/girl is optional; children without it only count toward the total limit.
- **History.** Shows who is out now, totals per child, and every trip, filtered by list and date. You can export it as CSV.
- **PIN lock.** You need a 4-digit PIN to leave the class screen. The screen also blocks the Back button, goes full screen and keeps the display awake.
- **Backup.** Save everything to a file and restore it on the same or another device.

## Putting it on your devices

Browsers only allow offline install from an `https://` address, so the files need to be hosted once. Any static host works. GitHub Pages is free:

1. Push this folder to a GitHub repository.
2. In the repository go to **Settings → Pages**, choose *Deploy from a branch*, pick `main` and `/ (root)`.
3. Open the Pages address on each device and install it:
   - **iPad / iPhone (Safari):** Share → *Add to Home Screen*.
   - **Android (Chrome):** menu → *Add to home screen* / *Install app*.
   - **Windows (Edge or Chrome):** the install icon in the address bar.
4. Open it once from the home screen while online. After that it works without internet.

The host only serves the app's files. Your class lists and history never leave the device.

## Locking the device to Hallpass

A web app can't block the Home button or app switching, because the operating system controls those. For a class-facing tablet, also turn on the device's own lock:

- **iPad:** Settings → Accessibility → *Guided Access*. Open Hallpass, triple-click the side/Home button to start it.
- **Android:** Settings → Security → *App pinning* (or *Pin windows*). Open Hallpass, then pin it from the recent-apps screen.
- **Windows:** Settings → Accounts → *Other users* → *Set up a kiosk* (Assigned Access) with Edge pointing at Hallpass.

## Good to know

- **Forgotten PIN:** there is no reset from the class screen. Clearing the browser's site data removes the PIN *and all data*, so save backups regularly (PIN & data tab).
- **iPad sounds:** on iPadOS 17 or later, sounds play even with the silent switch on. Older versions follow the switch.
- **Each device keeps its own data.** Use Backup → Restore to copy lists between devices.

## Updating the app

After changing any file, bump `CACHE` in `sw.js` (e.g. `hallpass-v2`) so installed copies fetch the new version the next time they open while online.

## Files

```
index.html              Page shell
styles.css              All styling
js/app.js               Screens, events, PIN pad, export
js/rules.js             Leaving limits and the 45-minute wait
js/store.js             Saving to the device (IndexedDB)
js/sound.js             Ding and error sounds (generated, no audio files)
sw.js                   Offline cache
manifest.webmanifest    Install details
icons/                  App icons
```
