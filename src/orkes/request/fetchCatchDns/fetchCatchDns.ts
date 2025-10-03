import { isIP } from "net";
import { DnsCacheResolver } from "./DnsCache";
import { FetchFn } from "../../types";

interface ModifiedUrlParameters {
  host: string;
  port: string;
  protocol: string;
  hostname: string;
}

const isEmpty = (value?: string): boolean => {
  return value === undefined || value.trim().length === 0;
};

export const toMaybeUrl = (
  originalUrl: RequestInfo,
  modifiedParams: ModifiedUrlParameters
): URL => {
  const urlToHit = new URL(originalUrl.toString());
  urlToHit.host = isEmpty(modifiedParams.port)
    ? `${modifiedParams.host}:${modifiedParams.port}`
    : modifiedParams.host;

  return urlToHit;
};

interface CatcherOptions {
  dnsCache?: DnsCacheResolver;
  headerFactory?: (headers?: HeadersInit) => Headers;
}

const DEFAULT_OPTIONS: CatcherOptions = {
  dnsCache: new DnsCacheResolver(),
  headerFactory: (headers?: HeadersInit) => new Headers(headers || {}),
};

export const fetchCatchDns = <
  T extends { headers?: HeadersInit | undefined },
  R extends { json: () => Promise<any> }
>(
  fetch: FetchFn<T, R>,
  {
    dnsCache = new DnsCacheResolver(),
    headerFactory = (headers?: HeadersInit) => new Headers(headers || {}),
  }: CatcherOptions = DEFAULT_OPTIONS
): FetchFn<T, R> => {
  const fetchWithDns: FetchFn<T, R> = async (input, options) => {
    const parsedUrl = new URL(input.toString());
    const { hostname, host, port } = parsedUrl;
    if (isIP(hostname)) {
      return await fetch(input, options);
    }
    const maybeTargetIp = await dnsCache.resolve(hostname);
    // DNS resolution failed, let original fetch handle it
    if (isEmpty(maybeTargetIp)) {
      return await fetch(input, options);
    }

    const target = toMaybeUrl(input, {
      ...parsedUrl,
      host: maybeTargetIp!,
      port: port,
    });

    const headersOverride: Headers = headerFactory(options?.headers ?? {});
    // need to set this since we are hitting the ip
    if (!headersOverride.has("Host")) {
      headersOverride.set("Host", host);
    }
    const optionsOverride = {
      ...options,
      headers: headersOverride,
    };

    try {
      const res = await fetch(target.toString(), optionsOverride as T);
      return res;
    } catch (e: NodeJS.ErrnoException | any) {
      if (e && e?.code === "ETIMEDOUT") {
        dnsCache.removeCache(hostname);
      }
      throw e;
    }
  };

  return fetchWithDns;
};
