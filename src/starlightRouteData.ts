import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

// Starlight renders a single 404.html, but its head still advertises a canonical
// /404/ URL and per-locale alternates (/zh/404/, ...) that are never built.
// A not-found page has no canonical address, so drop those links.
export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  if (route.id !== '404') return;
  route.head = route.head.filter(
    (entry) =>
      !(entry.tag === 'link' && (entry.attrs?.rel === 'canonical' || entry.attrs?.rel === 'alternate')) &&
      !(entry.tag === 'meta' && entry.attrs?.property === 'og:url')
  );
});
