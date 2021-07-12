const config = {
  basic: {
    upstream: 'https://x265lk.com/',
    mobileRedirect: 'https://x265lk.com/',
  },

  firewall: {
    blockedRegion: [],
    blockedIPAddress: [],
    scrapeShield: true,
  },

  routes: {},

  optimization: {
    cacheEverything: false,
    cacheTtl: 5,
    mirage: true,
    polish: 'off',
    minify: {
      javascript: true,
      css: true,
      html: true,
    },
  },
};

async function isMobile(userAgent) {
  const agents = ['Android', 'iPhone', 'SymbianOS', 'Windows Phone', 'iPad', 'iPod'];
  return agents.any((agent) => userAgent.indexOf(agent) > 0);
}

async function fetchAndApply(request) {
  const region = request.headers.get('cf-ipcountry') || '';
  const ipAddress = request.headers.get('cf-connecting-ip') || '';
  const userAgent = request.headers.get('user-agent') || '';

  if (region !== '' && config.firewall.blockedRegion.includes(region.toUpperCase())) {
    return new Response(
      'Access denied: website is not available in your region.',
      {
        status: 403,
      },
    );
  } if (ipAddress !== '' && config.firewall.blockedIPAddress.includes(ipAddress)) {
    return new Response(
      'Access denied: Your IP address is blocked.',
      {
        status: 403,
      },
    );
  }

  const requestURL = new URL(request.url);
  let upstreamURL = null;

  if (userAgent && isMobile(userAgent) === true) {
    upstreamURL = new URL(config.basic.mobileRedirect);
  } else if (region && region.toUpperCase() in config.routes) {
    upstreamURL = new URL(config.routes[region.toUpperCase()]);
  } else {
    upstreamURL = new URL(config.basic.upstream);
  }

  requestURL.protocol = upstreamURL.protocol;
  requestURL.host = upstreamURL.host;
  requestURL.pathname = upstreamURL.pathname + requestURL.pathname;

  let newRequest;
  if (request.method === 'GET' || request.method === 'HEAD') {
    newRequest = new Request(requestURL, {
      cf: {
        cacheEverything: config.optimization.cacheEverything,
        cacheTtl: config.optimization.cacheTtl,
        mirage: config.optimization.mirage,
        polish: config.optimization.polish,
        minify: config.optimization.minify,
        scrapeShield: config.firewall.scrapeShield,
      },
      method: request.method,
      headers: request.headers,
    });
  } else {
    const requestBody = await request.text();
    newRequest = new Request(requestURL, {
      cf: {
        cacheEverything: config.optimization.cacheEverything,
        cacheTtl: config.optimization.cacheTtl,
        mirage: config.optimization.mirage,
        polish: config.optimization.polish,
        minify: config.optimization.minify,
        scrapeShield: config.firewall.scrapeShield,
      },
      method: request.method,
      headers: request.headers,
      body: requestBody,
    });
  }

  const fetchedResponse = await fetch(newRequest);

  const modifiedResponseHeaders = new Headers(fetchedResponse.headers);
  if (modifiedResponseHeaders.has('x-pjax-url')) {
    const pjaxURL = new URL(modifiedResponseHeaders.get('x-pjax-url'));
    pjaxURL.protocol = requestURL.protocol;
    pjaxURL.host = requestURL.host;
    pjaxURL.pathname = pjaxURL.path.replace(requestURL.pathname, '/');

    modifiedResponseHeaders.set(
      'x-pjax-url',
      pjaxURL.href,
    );
  }

  return new Response(
    fetchedResponse.body,
    {
      headers: modifiedResponseHeaders,
      status: fetchedResponse.status,
      statusText: fetchedResponse.statusText,
    },
  );
}

// eslint-disable-next-line no-restricted-globals
addEventListener('fetch', (event) => {
  event.respondWith(fetchAndApply(event.request));
});
