export function browserChoice(channel = 'chromium') {
  if (!['chromium', 'msedge'].includes(channel)) throw new Error('Choose chromium or msedge for the browser.');
  return { channel, name: channel === 'msedge' ? 'Microsoft Edge' : 'Chromium',
    profileSuffix: channel === 'msedge' ? '-msedge' : '' };
}
