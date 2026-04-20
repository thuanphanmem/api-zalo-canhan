import type { Gender } from "./Enum.js";

export type UserBasic = {
    avatar: string;
    cover: string;
    status: string;
    gender: Gender;
    dob: number;
    sdob: string;
    globalId: string;
    uid: string;
    zalo_name: string;
    display_name: string;
};
