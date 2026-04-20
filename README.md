# api-zalo-canhan

Thư viện cộng đồng tối giản cho Zalo cá nhân. Repo này chỉ giữ đúng các phần phục vụ 4 việc chính:

- đăng nhập
- tìm user theo số điện thoại
- kết bạn
- nhắn tin text

Để phục vụ luồng gửi tin an toàn sau khi kết bạn, repo vẫn giữ thêm API kiểm tra trạng thái kết bạn. Đây là phần bắt buộc để không nhắn tin khi quan hệ bạn bè chưa sẵn sàng.

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
  const friendStatus = await api.getFriendRequestStatus(user.uid);

  if (friendStatus.is_friend === 1) {
    await api.sendMessage("Hệ thống đã ghi nhận thông tin của bạn.", user.uid);
  }
}
```

## API hiện có

- `Zalo.login(credentials)`
- `Zalo.loginQR(options?, callback?)`
- `api.getMultiUsersByPhones(phoneNumbers)`
- `api.getFriendRequestStatus(userId)`
- `api.sendFriendRequest(message, userId)`
- `api.sendMessage(message, userId)`

## Ghi chú

- `sendMessage` hiện chỉ hỗ trợ tin nhắn văn bản.
- `sendMessage` chỉ dành cho hội thoại cá nhân 1-1.
- Nếu vừa gửi lời mời kết bạn, nên lưu `userId` và kiểm tra lại `getFriendRequestStatus(userId)` trước khi nhắn.
- Nếu sau lần kiểm tra đầu vẫn chưa là bạn bè, có thể lên lịch kiểm tra lại sau 24 giờ rồi mới gửi tin.
