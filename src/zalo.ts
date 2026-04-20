import toughCookie from "tough-cookie";

import { loginQR, LoginQRCallbackEventType, type LoginQRCallback } from "./apis/loginQR.js";
import { getServerInfo, login } from "./apis/login.js";
import { API } from "./apis.js";
import {
    createContext,
    isContextSession,
    type ContextBase,
    type Options,
} from "./context.js";
import { ZaloApiError } from "./Errors/ZaloApiError.js";
import { generateZaloUUID, logger } from "./utils.js";

export type Cookie = {
    domain: string;
    expirationDate: number;
    hostOnly: boolean;
    httpOnly: boolean;
    name: string;
    path: string;
    sameSite: string;
    secure: boolean;
    session: boolean;
    storeId: string;
    value: string;
};

export type Credentials = {
    imei: string;
    cookie: Cookie[] | toughCookie.SerializedCookie[] | { url: string; cookies: Cookie[] };
    userAgent: string;
    language?: string;
};

export class Zalo {
    private enableEncryptParam = true;

    constructor(private options: Partial<Options> = {}) {}

    private parseCookies(cookie: Credentials["cookie"]): toughCookie.CookieJar {
        const cookieArr = Array.isArray(cookie) ? cookie : cookie.cookies;

        cookieArr.forEach((entry, index) => {
            if (typeof entry.domain === "string" && entry.domain.startsWith(".")) {
                cookieArr[index].domain = entry.domain.slice(1);
            }
        });

        const jar = new toughCookie.CookieJar();
        for (const entry of cookieArr) {
            try {
                const cookieObject = toughCookie.Cookie.fromJSON({
                    ...entry,
                    key: (entry as toughCookie.SerializedCookie).key || entry.name,
                });

                if (cookieObject) {
                    const domain = cookieObject.domain || "chat.zalo.me";
                    const url = `https://${domain.startsWith(".") ? domain.slice(1) : domain}`;
                    jar.setCookieSync(cookieObject, url);
                }
            } catch (error: unknown) {
                logger({
                    options: {
                        logging: this.options.logging,
                    },
                }).error("Failed to set cookie:", error);
            }
        }

        return jar;
    }

    private validateCredentials(credentials: Credentials) {
        if (!credentials.imei || !credentials.cookie || !credentials.userAgent) {
            throw new ZaloApiError("Missing required params");
        }
    }

    public async login(credentials: Credentials) {
        const ctx = createContext(this.options.apiType, this.options.apiVersion);
        Object.assign(ctx.options, this.options);

        return this.loginWithCookie(ctx, credentials);
    }

    private async loginWithCookie(ctx: ContextBase, credentials: Credentials) {
        this.validateCredentials(credentials);

        ctx.imei = credentials.imei;
        ctx.cookie = this.parseCookies(credentials.cookie);
        ctx.userAgent = credentials.userAgent;
        ctx.language = credentials.language || "vi";

        const loginData = await login(ctx, this.enableEncryptParam);
        const serverInfo = await getServerInfo(ctx, this.enableEncryptParam);
        const loginInfo = loginData?.data as typeof ctx.loginInfo;

        if (!loginData || !loginInfo || !serverInfo) {
            throw new ZaloApiError("Đăng nhập thất bại");
        }

        ctx.secretKey = loginInfo.zpw_enk;
        ctx.uid = loginInfo.uid;
        ctx.settings = serverInfo.setttings || serverInfo.settings;
        ctx.extraVer = serverInfo.extra_ver;
        ctx.loginInfo = loginInfo;

        if (!isContextSession(ctx)) {
            throw new ZaloApiError("Khởi tạo ngữ cảnh thất bại.");
        }

        logger(ctx).info("Logged in as", loginInfo.uid);

        return new API(ctx, loginInfo.zpw_service_map_v3);
    }

    public async loginQR(
        options?: { userAgent?: string; language?: string; qrPath?: string },
        callback?: LoginQRCallback,
    ) {
        if (!options) options = {};
        if (!options.userAgent) {
            options.userAgent =
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";
        }
        if (!options.language) {
            options.language = "vi";
        }

        const ctx = createContext(this.options.apiType, this.options.apiVersion);
        Object.assign(ctx.options, this.options);

        const loginQRResult = await loginQR(
            ctx,
            options as { userAgent: string; language: string; qrPath?: string },
            callback,
        );

        if (!loginQRResult) {
            throw new ZaloApiError("Unable to login with QRCode");
        }

        const imei = generateZaloUUID(options.userAgent);

        if (callback) {
            callback({
                type: LoginQRCallbackEventType.GotLoginInfo,
                data: {
                    cookie: loginQRResult.cookies,
                    imei,
                    userAgent: options.userAgent,
                },
                actions: null,
            });
        }

        return this.loginWithCookie(ctx, {
            cookie: loginQRResult.cookies,
            imei,
            userAgent: options.userAgent,
            language: options.language,
        });
    }
}

export { API };
