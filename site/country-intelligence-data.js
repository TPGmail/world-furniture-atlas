/* Furniverse Country Intelligence v2.0. Editorial roles are NOT verified statistics.
   Source-linked facts come from atlas-briefs.js; raw atlas notes remain untouched. */
window.FURNIVERSE_INDUSTRY = Object.freeze({
    schemaVersion: 1,
    updatedOn: "2026-11-08",
    roles: {
        resource: "Resource Hub · Nguyên liệu",
        manufacturing: "Manufacturing Hub · Sản xuất",
        design: "Design Hub · Thiết kế",
        consumer: "Consumer Market · Tiêu thụ",
        trading: "Trading Hub · Thương mại",
        technology: "Technology Hub · Công nghệ"
    },
    profiles: {
        "840": {region:"Bắc Mỹ",roles:["consumer","design"],focus:["Thị trường tiêu dùng","Bán lẻ nội thất"],review:"editorial"},
        "704": {region:"Đông Nam Á",roles:["manufacturing","trading"],focus:["Gia công nội thất xuất khẩu","Nội thất gỗ"],review:"editorial",
            trade:[{year:2025,metric:"Xuất khẩu gỗ và sản phẩm gỗ",value:"Khoảng 18,5 tỷ USD",source:"vn-trade"},
                   {year:2025,metric:"Xuất khẩu riêng nội thất gỗ",value:"Khoảng 10,25 tỷ USD",source:"vn-trade"}]},
        "276": {region:"Châu Âu",roles:["consumer","technology"],focus:["Thị trường EU","Thiết bị và công nghệ ngành gỗ"],review:"editorial"},
        "826": {region:"Châu Âu",roles:["consumer"],focus:["Thị trường nội thất nhập khẩu"],review:"editorial"},
        "124": {region:"Bắc Mỹ",roles:["consumer"],focus:["Thị trường nội thất","Ván gỗ công nghiệp"],review:"editorial"},
        "036": {region:"Châu Đại Dương",roles:["consumer"],focus:["Outdoor furniture","Kiểm soát gỗ hợp pháp"],review:"editorial"},
        "360": {region:"Đông Nam Á",roles:["resource","manufacturing"],focus:["Chế biến gỗ","Truy xuất nguồn gốc"],review:"editorial"},
        "cn-44": {region:"Quảng Đông, Trung Quốc",roles:["manufacturing","trading"],focus:["Cụm sản xuất Longjiang","Cụm thương mại Lecong"],review:"editorial"},
        "528": {region:"Châu Âu",roles:["trading","consumer"],focus:["Thương mại nội thất","Thị trường EU"],review:"editorial"},
        "616": {region:"Châu Âu",roles:["manufacturing"],focus:["Gia công nội thất","Nguồn cung EU"],review:"editorial"},
        "380": {region:"Châu Âu",roles:["design","manufacturing"],focus:["Thiết kế nội thất","Sản xuất nội thất","Nội thất phòng tắm"],review:"editorial",trade:[{year:2025,metric:"Xuất khẩu nhóm ngành nội thất",value:"14,2 tỷ EUR",source:"it-fla-2025"}]},
        "208": {region:"Bắc Âu",roles:["design"],focus:["Thiết kế nội thất"],review:"editorial"},
        "752": {region:"Bắc Âu",roles:["design","consumer"],focus:["Thiết kế nội thất","Thị trường nội thất"],review:"editorial"},
        "392": {region:"Đông Á",roles:["consumer"],focus:["Thị trường nhập khẩu nội thất","Nguồn gỗ hợp pháp"],review:"editorial"},
        "410": {region:"Đông Á",roles:["consumer","manufacturing"],focus:["Thị trường sản phẩm gỗ","Kiểm soát nhập khẩu nguyên liệu"],review:"editorial"},
        "458": {region:"Đông Nam Á",roles:["manufacturing","trading"],focus:["Sản xuất nội thất gỗ","Xuất khẩu đồ gỗ"],review:"editorial",trade:[{year:2025,metric:"Xuất khẩu nội thất gỗ",value:"9,28 tỷ MYR",source:"my-mtc-2025"}]},
        "076": {region:"Nam Mỹ",roles:["manufacturing","resource"],focus:["Sản xuất nội thất","Xuất khẩu nội thất thành phẩm"],review:"editorial",trade:[{year:2025,metric:"Xuất khẩu nội thất thành phẩm và nệm (không gồm linh kiện)",value:"769,3 triệu USD",source:"br-abimovel"}]}
    },
    publicResearch: [
        {label:"UN Comtrade · Thương mại quốc tế",url:"https://comtradeplus.un.org/"},
        {label:"ITTO · Dữ liệu gỗ nhiệt đới",url:"https://www.itto.int/"},
        {label:"WTO · Tariff & Trade Data",url:"https://ttd.wto.org/"}
    ]
});
