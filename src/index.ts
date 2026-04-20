export * from "./Errors/index.js";
export { Zalo, API, type Cookie, type Credentials } from "./zalo.js";
export { AvatarSize } from "./models/index.js";
export type { UserBasic } from "./models/index.js";
export type { Options } from "./context.js";

export type { GetFriendRequestStatusResponse } from "./apis/getFriendRequestStatus.js";
export type { GetMultiUsersByPhonesResponse } from "./apis/getMultiUsersByPhones.js";
export type { LoginQRCallback, LoginQRCallbackEvent } from "./apis/loginQR.js";
export type { SendFriendRequestResponse } from "./apis/sendFriendRequest.js";
export type { SendMessageResponse, SendMessageResult } from "./apis/sendMessage.js";

export { LoginQRCallbackEventType } from "./apis/loginQR.js";
