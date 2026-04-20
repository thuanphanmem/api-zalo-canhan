import { ThreadType } from "../models/index.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { apiFactory, removeUndefinedKeys } from "../utils.js";

export type SendMessageResult = {
    msgId: number;
};

export type SendMessageResponse = {
    message: SendMessageResult | null;
    attachment: SendMessageResult[];
};

export const sendMessageFactory = apiFactory<SendMessageResponse>()((api, ctx, utils) => {
    const serviceURLs = {
        [ThreadType.User]: utils.makeURL(`${api.zpwServiceMap.chat[0]}/api/message`, {
            nretry: 0,
        }),
        [ThreadType.Group]: utils.makeURL(`${api.zpwServiceMap.group[0]}/api/group`, {
            nretry: 0,
        }),
    };

    return async function sendMessage(message: string, threadId: string, type: ThreadType = ThreadType.User) {
        if (!message || !message.trim()) {
            throw new ZaloApiError("Missing message content");
        }

        if (!threadId) {
            throw new ZaloApiError("Missing threadId");
        }

        const isGroupMessage = type === ThreadType.Group;
        const params = {
            message,
            clientId: Date.now(),
            imei: isGroupMessage ? undefined : ctx.imei,
            ttl: 0,
            visibility: isGroupMessage ? 0 : undefined,
            toid: isGroupMessage ? undefined : threadId,
            grid: isGroupMessage ? threadId : undefined,
        };

        removeUndefinedKeys(params);

        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams) {
            throw new ZaloApiError("Failed to encrypt message");
        }

        const url = new URL(serviceURLs[type]);
        url.pathname += `/${isGroupMessage ? "sendmsg" : "sms"}`;

        const response = await utils.request(url.toString(), {
            method: "POST",
            body: new URLSearchParams({ params: encryptedParams }),
        });

        const result = await utils.resolve(response, (payload) => {
            const data = payload.data as SendMessageResult | null;
            return {
                message: data,
                attachment: [],
            };
        });

        return result;
    };
});
