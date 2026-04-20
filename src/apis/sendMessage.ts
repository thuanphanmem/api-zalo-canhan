import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { apiFactory } from "../utils.js";

export type SendMessageResult = {
    msgId: number;
};

export type SendMessageResponse = {
    message: SendMessageResult | null;
};

export const sendMessageFactory = apiFactory<SendMessageResponse>()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${ctx.zpwServiceMap.chat[0]}/api/message`, {
        nretry: 0,
    });

    return async function sendMessage(message: string, userId: string) {
        if (!message || !message.trim()) {
            throw new ZaloApiError("Missing message content");
        }

        if (!userId) {
            throw new ZaloApiError("Missing userId");
        }

        const params = {
            message,
            clientId: Date.now(),
            imei: ctx.imei,
            ttl: 0,
            toid: userId,
        };

        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams) {
            throw new ZaloApiError("Failed to encrypt message");
        }

        const url = new URL(serviceURL);
        url.pathname += "/sms";

        const response = await utils.request(url.toString(), {
            method: "POST",
            body: new URLSearchParams({ params: encryptedParams }),
        });

        const result = await utils.resolve(response, (payload) => {
            const data = payload.data as SendMessageResult | null;
            return {
                message: data,
            };
        });

        return result;
    };
});
