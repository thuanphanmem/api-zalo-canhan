import type { ContextSession, ZPWServiceMap } from "./context.js";
import { getFriendRequestStatusFactory } from "./apis/getFriendRequestStatus.js";
import { getMultiUsersByPhonesFactory } from "./apis/getMultiUsersByPhones.js";
import { sendFriendRequestFactory } from "./apis/sendFriendRequest.js";
import { sendMessageFactory } from "./apis/sendMessage.js";

export class API {
    public zpwServiceMap: ZPWServiceMap;
    public getFriendRequestStatus: ReturnType<typeof getFriendRequestStatusFactory>;
    public getMultiUsersByPhones: ReturnType<typeof getMultiUsersByPhonesFactory>;
    public sendFriendRequest: ReturnType<typeof sendFriendRequestFactory>;
    public sendMessage: ReturnType<typeof sendMessageFactory>;

    constructor(ctx: ContextSession, zpwServiceMap: ZPWServiceMap) {
        this.zpwServiceMap = zpwServiceMap;
        this.getFriendRequestStatus = getFriendRequestStatusFactory(ctx, this);
        this.getMultiUsersByPhones = getMultiUsersByPhonesFactory(ctx, this);
        this.sendFriendRequest = sendFriendRequestFactory(ctx, this);
        this.sendMessage = sendMessageFactory(ctx, this);
    }
}
