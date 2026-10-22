import http from 'node:http';

// Native HTTP preserves an explicit Host header when testing reverse-proxy routing.
export function httpFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, options, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8'), headers = new Headers();
        for (let i = 0; i < response.rawHeaders.length; i += 2) headers.append(response.rawHeaders[i], response.rawHeaders[i+1]);
        resolve({ status: response.statusCode, headers, json: async () => JSON.parse(text), text: async () => text });
      });
    });
    request.on('error', reject);
    request.end(options.body);
  });
}
