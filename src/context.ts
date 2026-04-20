import type { Agent } from "http";
import type { CookieJar } from "tough-cookie";

type ShareFileSettings = {
    max_file: number;
    max_size_share_file_v3: number;
};

type SocketSettings = {
    ping_interval: number;
};

type LoginInfo = {
    uid: string;
    zpw_enk: string;
    zpw_ws: string[];
    zpw_service_map_v3: {
        chat: string[];
        file: string[];
        friend: string[];
        group: string[];
    };
    [key: string]: unknown;
};

type ExtraVer = {
    friend: string;
};

export type ZPWServiceMap = LoginInfo["zpw_service_map_v3"];

export type AppContextBase = {
    uid: string;
    imei: string;
    cookie: CookieJar;
    userAgent: string;
    language: string;
    secretKey: string | null;
    zpwServiceMap: ZPWServiceMap;
    settings: {
        [key: string]: unknown;
        features: {
            [key: string]: unknown;
            sharefile: ShareFileSettings;
            socket: SocketSettings;
        };
    };
    loginInfo: LoginInfo;
    extraVer: ExtraVer;
};

export type ImageMetadataGetterResponse = { width: number; height: number; size: number } | null;
export type ImageMetadataGetter = (filePath: string) => Promise<ImageMetadataGetterResponse>;

export type Options = {
    checkUpdate: boolean;
    logging: boolean;
    apiType: number;
    apiVersion: number;
    agent?: Agent;
    polyfill: typeof fetch;
};

export type AppContextExtended = {
    options: Options;
    readonly API_TYPE: number;
    readonly API_VERSION: number;
};

export type ContextBase = Partial<AppContextBase> & AppContextExtended;

export const createContext = (apiType = 30, apiVersion = 671) =>
    ({
        API_TYPE: apiType,
        API_VERSION: apiVersion,
        options: {
            checkUpdate: false,
            logging: true,
            polyfill: global.fetch,
        },
        secretKey: null,
    }) as ContextBase;

export type ContextSession = AppContextBase & AppContextExtended & { secretKey: string };

export function isContextSession(ctx: ContextBase): ctx is ContextSession {
    return !!ctx.secretKey;
}
