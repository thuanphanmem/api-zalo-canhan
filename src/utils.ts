import cryptojs from "crypto-js";
import crypto from "node:crypto";
import toughCookie from "tough-cookie";

import { isContextSession, type ContextBase, type ContextSession } from "./context.js";
import { ZaloApiError } from "./Errors/index.js";
import type { API } from "./zalo.js";

export const isBun = "Bun" in globalThis;

export function hasOwn(obj: Record<string, unknown>, key: string): key is keyof typeof obj {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

export function getSignKey(type: string, params: Record<string, unknown>) {
    const keys: string[] = [];
    for (const key in params) {
        if (hasOwn(params, key)) {
            keys.push(key);
        }
    }

    keys.sort();
    let source = "zsecure" + type;
    for (const key of keys) {
        source += params[key];
    }

    return cryptojs.MD5(source).toString();
}

export function makeURL(
    ctx: ContextBase,
    baseURL: string,
    params: Record<string, string | number> = {},
    apiVersion: boolean = true,
) {
    const url = new URL(baseURL);
    for (const key in params) {
        if (hasOwn(params, key)) {
            url.searchParams.append(key, params[key].toString());
        }
    }

    if (apiVersion) {
        if (!url.searchParams.has("zpw_ver")) {
            url.searchParams.set("zpw_ver", ctx.API_VERSION.toString());
        }
        if (!url.searchParams.has("zpw_type")) {
            url.searchParams.set("zpw_type", ctx.API_TYPE.toString());
        }
    }

    return url.toString();
}

export class ParamsEncryptor {
    private zcid: string | null = null;
    private enc_ver = "v2";
    private zcid_ext: string;
    private encryptKey: string | null = null;

    constructor({ type, imei, firstLaunchTime }: { type: number; imei: string; firstLaunchTime: number }) {
        this.createZcid(type, imei, firstLaunchTime);
        this.zcid_ext = ParamsEncryptor.randomString();
        this.createEncryptKey();
    }

    getEncryptKey() {
        if (!this.encryptKey) {
            throw new ZaloApiError("getEncryptKey: didn't create encryptKey yet");
        }
        return this.encryptKey;
    }

    private createZcid(type: number, imei: string, firstLaunchTime: number) {
        if (!type || !imei || !firstLaunchTime) {
            throw new ZaloApiError("createZcid: missing params");
        }

        const message = `${type},${imei},${firstLaunchTime}`;
        this.zcid = ParamsEncryptor.encodeAES("3FC4F0D2AB50057BCE0D90D9187A22B1", message, "hex", true);
    }

    private createEncryptKey(retry = 0) {
        const assignKey = (left: string, right: string) => {
            const { even: leftEven } = ParamsEncryptor.processStr(left);
            const { even: rightEven, odd: rightOdd } = ParamsEncryptor.processStr(right);
            if (!leftEven || !rightEven || !rightOdd) {
                return false;
            }

            this.encryptKey =
                leftEven.slice(0, 8).join("") +
                rightEven.slice(0, 12).join("") +
                rightOdd.reverse().slice(0, 12).join("");
            return true;
        };

        if (!this.zcid || !this.zcid_ext) {
            throw new ZaloApiError("createEncryptKey: zcid or zcid_ext is null");
        }

        try {
            const digest = cryptojs.MD5(this.zcid_ext).toString().toUpperCase();
            if (assignKey(digest, this.zcid) || retry >= 3) {
                return;
            }
            this.createEncryptKey(retry + 1);
        } catch {
            if (retry < 3) {
                this.createEncryptKey(retry + 1);
            }
        }
    }

    getParams() {
        return this.zcid
            ? {
                  zcid: this.zcid,
                  zcid_ext: this.zcid_ext,
                  enc_ver: this.enc_ver,
              }
            : null;
    }

    static processStr(value: string) {
        if (!value || typeof value !== "string") {
            return { even: null, odd: null };
        }

        const [even, odd] = [...value].reduce(
            (groups, char, index) => {
                groups[index % 2].push(char);
                return groups;
            },
            [[], []] as string[][],
        );

        return { even, odd };
    }

    static randomString(min = 6, max = 12) {
        let length = Math.floor(Math.random() * (max - min + 1)) + min;
        if (length > 12) {
            let output = "";
            while (length > 0) {
                output += Math.random().toString(16).substr(2, length > 12 ? 12 : length);
                length -= 12;
            }
            return output;
        }
        return Math.random().toString(16).substr(2, length);
    }

    static encodeAES(
        keyValue: string,
        message: string,
        type: "hex" | "base64",
        uppercase: boolean,
        retry = 0,
    ): string | null {
        if (!message) {
            return null;
        }

        try {
            const encoder = type === "hex" ? cryptojs.enc.Hex : cryptojs.enc.Base64;
            const key = cryptojs.enc.Utf8.parse(keyValue);
            const iv = { words: [0, 0, 0, 0], sigBytes: 16 } as cryptojs.lib.WordArray;
            const encrypted = cryptojs.AES.encrypt(message, key, {
                iv,
                mode: cryptojs.mode.CBC,
                padding: cryptojs.pad.Pkcs7,
            }).ciphertext.toString(encoder);

            return uppercase ? encrypted.toUpperCase() : encrypted;
        } catch {
            return retry < 3 ? ParamsEncryptor.encodeAES(keyValue, message, type, uppercase, retry + 1) : null;
        }
    }
}

export function decryptResp(key: string, data: string): Record<string, unknown> | null | string {
    let output: string | null = null;
    try {
        output = decodeRespAES(key, data);
        return JSON.parse(output);
    } catch {
        return output;
    }
}

function decodeRespAES(key: string, data: string) {
    const decoded = decodeURIComponent(data);
    const parsedKey = cryptojs.enc.Utf8.parse(key);
    const iv = { words: [0, 0, 0, 0], sigBytes: 16 } as cryptojs.lib.WordArray;

    return cryptojs.AES.decrypt(
        { ciphertext: cryptojs.enc.Base64.parse(decoded) } as cryptojs.lib.CipherParams,
        parsedKey,
        { iv, mode: cryptojs.mode.CBC, padding: cryptojs.pad.Pkcs7 },
    ).toString(cryptojs.enc.Utf8);
}

export function encodeAES(
    secretKey: string,
    data: cryptojs.lib.WordArray | string,
    retry = 0,
): string | null {
    try {
        const key = cryptojs.enc.Base64.parse(secretKey);
        return cryptojs.AES.encrypt(data, key, {
            iv: cryptojs.enc.Hex.parse("00000000000000000000000000000000"),
            mode: cryptojs.mode.CBC,
            padding: cryptojs.pad.Pkcs7,
        }).ciphertext.toString(cryptojs.enc.Base64);
    } catch {
        return retry < 3 ? encodeAES(secretKey, data, retry + 1) : null;
    }
}

export function decodeAES(secretKey: string, data: string, retry = 0): string | null {
    try {
        const decoded = decodeURIComponent(data);
        const key = cryptojs.enc.Base64.parse(secretKey);
        return cryptojs.AES.decrypt(
            { ciphertext: cryptojs.enc.Base64.parse(decoded) } as cryptojs.lib.CipherParams,
            key,
            {
                iv: cryptojs.enc.Hex.parse("00000000000000000000000000000000"),
                mode: cryptojs.mode.CBC,
                padding: cryptojs.pad.Pkcs7,
            },
        ).toString(cryptojs.enc.Utf8);
    } catch {
        return retry < 3 ? decodeAES(secretKey, data, retry + 1) : null;
    }
}

export async function getDefaultHeaders(ctx: ContextBase, origin = "https://chat.zalo.me") {
    if (!ctx.cookie) {
        throw new ZaloApiError("Cookie is not available");
    }
    if (!ctx.userAgent) {
        throw new ZaloApiError("User agent is not available");
    }

    return {
        Accept: "application/json, text/plain, */*",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.9",
        "content-type": "application/x-www-form-urlencoded",
        Cookie: await ctx.cookie.getCookieString(origin),
        Origin: "https://chat.zalo.me",
        Referer: "https://chat.zalo.me/",
        "User-Agent": ctx.userAgent,
    };
}

export async function request(ctx: ContextBase, url: string, options?: RequestInit, raw = false) {
    if (!ctx.cookie) {
        ctx.cookie = new toughCookie.CookieJar();
    }

    const origin = new URL(url).origin;
    const defaultHeaders = await getDefaultHeaders(ctx, origin);

    if (!raw) {
        if (options) {
            options.headers = Object.assign(defaultHeaders, options.headers || {});
        } else {
            options = { headers: defaultHeaders };
        }
    }

    const requestOptions = {
        ...(options ?? {}),
        ...(isBun
            ? {
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  proxy: ctx.options.agent?.proxy?.href,
              }
            : { agent: ctx.options.agent }),
    };

    const response = await ctx.options.polyfill(url, requestOptions);
    const setCookieRaw = response.headers.get("set-cookie");
    if (setCookieRaw && !raw) {
        const cookieStrings =
            typeof response.headers.getSetCookie === "function"
                ? response.headers.getSetCookie()
                : setCookieRaw.split(", ");

        for (const cookie of cookieStrings) {
            const parsed = toughCookie.Cookie.parse(cookie);
            try {
                if (parsed) {
                    await ctx.cookie.setCookie(parsed, parsed.domain !== "zalo.me" ? `https://${parsed.domain}` : origin);
                }
            } catch (error: unknown) {
                logger(ctx).error(error);
            }
        }
    }

    const redirectURL = response.headers.get("location");
    if (redirectURL) {
        const redirectOptions = { ...options, method: "GET" };
        if (!raw) {
            redirectOptions.headers = new Headers(redirectOptions.headers);
            redirectOptions.headers.set("Referer", "https://id.zalo.me/");
        }
        return request(ctx, redirectURL, redirectOptions);
    }

    return response;
}

export const logger = (ctx: { options: { logging?: boolean } }) => ({
    info: (...args: unknown[]) => {
        if (ctx.options.logging) console.log("\x1b[34mINFO\x1b[0m", ...args);
    },
    error: (...args: unknown[]) => {
        if (ctx.options.logging) console.log("\x1b[31mERROR\x1b[0m", ...args);
    },
});

type ZaloResponse<T> = {
    data: T | null;
    error: {
        message: string;
        code?: number;
    } | null;
};

export async function handleZaloResponse<T = unknown>(ctx: ContextSession, response: Response, isEncrypted = true) {
    const result: ZaloResponse<T> = {
        data: null,
        error: null,
    };

    if (!response.ok) {
        result.error = {
            message: "Request failed with status code " + response.status,
        };
        return result;
    }

    try {
        const jsonData = (await response.json()) as {
            error_code: number;
            error_message: string;
            data: string;
        };

        if (jsonData.error_code !== 0) {
            result.error = {
                message: jsonData.error_message,
                code: jsonData.error_code,
            };
            return result;
        }

        const decodedData = isEncrypted ? JSON.parse(decodeAES(ctx.secretKey, jsonData.data)!) : jsonData;

        if (decodedData.error_code !== 0) {
            result.error = {
                message: decodedData.error_message,
                code: decodedData.error_code,
            };
            return result;
        }

        result.data = decodedData.data;
    } catch (error) {
        logger(ctx).error("Failed to parse response data:", error);
        result.error = {
            message: "Failed to parse response data",
        };
    }

    return result;
}

export async function resolveResponse<T = unknown>(
    ctx: ContextSession,
    response: Response,
    callback?: (result: ZaloResponse<unknown>) => T,
    isEncrypted?: boolean,
) {
    const result = await handleZaloResponse<T>(ctx, response, isEncrypted);
    if (result.error) {
        throw new ZaloApiError(result.error.message, result.error.code);
    }
    if (callback) {
        return callback(result);
    }
    return result.data as T;
}

export type FactoryUtils<T> = {
    makeURL: (
        baseURL: string,
        params?: Record<string, string | number>,
        apiVersion?: boolean,
    ) => ReturnType<typeof makeURL>;
    encodeAES: (data: cryptojs.lib.WordArray | string, retry?: number) => ReturnType<typeof encodeAES>;
    request: (url: string, options?: RequestInit, raw?: boolean) => ReturnType<typeof request>;
    logger: ReturnType<typeof logger>;
    resolve: (
        response: Response,
        callback?: (result: ZaloResponse<unknown>) => T,
        isEncrypted?: boolean,
    ) => ReturnType<typeof resolveResponse<T>>;
};

export function apiFactory<T>() {
    return <K extends (api: API, ctx: ContextSession, utils: FactoryUtils<T>) => unknown>(callback: K) => {
        return (ctx: ContextBase, api: API) => {
            if (!isContextSession(ctx)) {
                throw new ZaloApiError("Invalid context " + JSON.stringify(ctx, null, 2));
            }

            const boundUtils = {
                makeURL(baseURL: string, params?: Record<string, string | number>, apiVersion?: boolean) {
                    return makeURL(ctx, baseURL, params, apiVersion);
                },
                encodeAES(data: cryptojs.lib.WordArray | string, retry?: number) {
                    return encodeAES(ctx.secretKey, data, retry);
                },
                request(url: string, options?: RequestInit, raw?: boolean) {
                    return request(ctx, url, options, raw);
                },
                logger: logger(ctx),
                resolve(response: Response, callback?: (result: ZaloResponse<unknown>) => T, isEncrypted?: boolean) {
                    return resolveResponse<T>(ctx, response, callback, isEncrypted);
                },
            };

            return callback(api, ctx, boundUtils) as ReturnType<K>;
        };
    };
}

export function generateZaloUUID(userAgent: string) {
    return crypto.randomUUID() + "-" + cryptojs.MD5(userAgent).toString();
}

export function removeUndefinedKeys(record: Record<string, unknown>) {
    for (const key in record) {
        if (record[key] === undefined) {
            delete record[key];
        }
    }
    return record;
}
