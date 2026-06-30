import { useEffect } from "react";

const BASE_URL = "https://ucultra.com";

interface PageMeta {
  title: string;
  description?: string;
  path?: string;
}

function setMeta(selector: string, attr: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    const [, name] = selector.match(/\[(?:name|property)="([^"]+)"\]/) ?? [];
    if (selector.includes("property=")) el.setAttribute("property", name);
    else el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Set per-route SEO meta: <title>, description, canonical, and og:* tags.
 * Path defaults to the current location.
 */
export function usePageMeta({ title, description, path }: PageMeta) {
  useEffect(() => {
    const url = `${BASE_URL}${path ?? window.location.pathname}`;
    document.title = title;
    if (description) {
      setMeta('meta[name="description"]', "content", description);
      setMeta('meta[property="og:description"]', "content", description);
      setMeta('meta[name="twitter:description"]', "content", description);
    }
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[property="og:url"]', "content", url);
    setLink("canonical", url);
  }, [title, description, path]);
}
