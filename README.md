# api-zalo-canhan

Thư viện cộng đồng tối giản cho Zalo cá nhân, tập trung vào các nhu cầu automation cơ bản:

- đăng nhập bằng cookie
- đăng nhập bằng QR
- tìm tài khoản theo số điện thoại
- kiểm tra trạng thái kết bạn
- gửi lời mời kết bạn
- gửi tin nhắn văn bản

Repo này chủ động giữ phạm vi nhỏ để dễ vận hành và dễ bảo trì trong môi trường production.

## Cài đặt

```bash
npm install
```

## Build

```bash
npm run build
```

## Ví dụ sử dụng

```ts
import { Zalo } from "api-zalo-canhan";

const zalo = new Zalo();
const api = await zalo.loginQR();

const users = await api.getMultiUsersByPhones("84901234567");
const user = users["84901234567"];

if (user?.uid) {
  await api.sendFriendRequest("Xin chào, mình gửi lời mời kết bạn để xác nhận đăng ký.", user.uid);
  await api.sendMessage("Hệ thống đã ghi nhận thông tin của bạn.", user.uid);
}
```

## API hiện có

- `Zalo.login(credentials)`
- `Zalo.loginQR(options?, callback?)`
- `api.getMultiUsersByPhones(phoneNumbers)`
- `api.getFriendRequestStatus(userId)`
- `api.sendFriendRequest(message, userId)`
- `api.sendMessage(message, threadId)`

## Ghi chú

- `sendMessage` hiện chỉ hỗ trợ tin nhắn văn bản.
- Dự án này được định hướng như một codebase cộng đồng, ưu tiên tối giản và rõ phạm vi.
