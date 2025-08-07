export function twimlGatherSay(message: string, actionUrl: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Gather input="speech" action="${actionUrl}" method="POST" speechTimeout="auto">\n    <Say voice="Polly.Joanna">${escapeXml(message)}</Say>\n  </Gather>\n  <Say>Sorry, I didn't get that. Please try again.</Say>\n  <Redirect method="POST">${actionUrl}</Redirect>\n</Response>`;
}

export function twimlSayHangup(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="Polly.Joanna">${escapeXml(message)}</Say>\n  <Hangup/>\n</Response>`;
}

function escapeXml(unsafe: string) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}