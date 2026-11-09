// An example's preview is an iframe that is as tall as its content, so a panel that opens out of the flow (a dropdown's) would
// have no room to open in. A page gives such a preview this local style: a body tall enough for the panel, with the trigger at
// the top of it (at the bottom, for an example whose panel opens above its trigger). The source shown on the page is Shoelace's,
// without it.
const ROOM = (end: boolean) => `<style>body{min-height:26rem;display:flex;flex-direction:column;justify-content:${end ? 'flex-end' : 'flex-start'};align-items:flex-start}</style>`;

/** The example document with room for an open panel (see above); the shown source is not changed. */
export const withRoomForPanel = (doc: string, anchor: 'top' | 'bottom' = 'top'): string => doc.replace('</head>', `${ROOM(anchor === 'bottom')}</head>`);
