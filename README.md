# World Furniture Atlas v1.9 · Correct customer mapping

Ngày phát hành: 2026-11-08. Repository riêng `TPGmail/world-furniture-atlas`.

## Thay đổi

- **Xóa toàn bộ 126 tọa độ tâm thành phố và offset khỏi bản đồ công khai**, không dùng lại trong bản dữ liệu mới.
- **123 địa chỉ khách hàng** được tách vào `site/customer-addresses.js`, không có lat/lng hoặc dịch vị trí.
- **46** có nguồn đăng ký/công khai, **77** theo Excel chưa đối chiếu với pháp nhân.
- Sửa lỗi MasterBrand: trụ sở chính tại Beachwood, Ohio (không phải nhà máy Jasper); loại địa chỉ sai Aukey.
- Trang mới có chế độ thị trường (D3) và **Khách hàng (Google Maps)** riêng.
- Khi Google Geocoder báo vị trí chính xác `ROOFTOP` và không `partial_match`, mới tạo chấm đúng địa chỉ. Không dùng tâm thành phố, không dịch điểm.
- Tự động loại kết quả Google chỉ ở mức `GEOMETRIC_CENTER`, `APPROXIMATE`, `RANGE_INTERPOLATED`.
- Giữ kích thước red dot: nhỏ 0,8px / vừa 1,2px / lớn 2px. Các khách cùng GPS gộp popup.
- Cache tạm kết quả lat/lng tối đa 28 ngày, không commit tọa độ của Google vào GitHub.

## Kích hoạt Google Maps (cần thao tác Google Cloud của chủ tài khoản)

1. Trên https://console.cloud.google.com/ tạo/chọn **project Atlas riêng**, bật billing.
2. Bật **Maps JavaScript API** và **Geocoding API**.
3. Tạo **API key**, chọn website restriction `https://tpgmail.github.io/*`, API restrictions chỉ hai API trên, thiết lập quota/budget.
4. Mở https://tpgmail.github.io/world-furniture-atlas/, chọn **Khách hàng · Google Maps**, điền key trong ô ở website, nhấn **Kết nối Google Maps**, sau đó **Xác minh vị trí & đặt chấm đỏ**.
5. Không gửi API key trên chat; key chỉ được lưu trong trình duyệt, không lên GitHub.

Nếu chưa kích hoạt API key, website hiển thị **danh bạ địa chỉ** với nút mở từng doanh nghiệp trong Google Maps nhưng **không hiện chấm ước lượng**.

## Google My Maps (không cần lập trình / API key)

File `Customer_Addresses_For_Google_My_Maps_2026-11-08.csv` gồm địa chỉ hiện có. Có thể import vào https://www.google.com/mymaps để Google tự định vị, sau đó kiểm tra từng kết quả trước khi xuất bản My Maps. Không tự coi kết quả tự động đó là đã xác minh 100%.

## Phạm vi giữ nguyên

- 59 hồ sơ thị trường và 28 source variants nguyên vẹn.
- Ghi chú riêng và Google Drive sync không thay đổi.
- Không sửa website `tienphat-website`.

## Tài liệu nội bộ

- `CUSTOMER_ADDRESS_AUDIT_v1.9.md` là báo cáo sửa/loại dữ liệu.
- `customer-address-review.json` gồm dữ liệu rà soát, để **ngoài thư mục `site/`**, không public trên website.