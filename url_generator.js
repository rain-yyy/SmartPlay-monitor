
function generateUrl() {

    const today = new Date();
    // FOTP 足球， BADC 羽毛球, BAGM 篮球， BASC 乒乓球
    const typeCode = {'FOTP': '足球', 'BADC': '羽毛球', 'BAGM': '籃球', 'BASC': '乒乓球'};
    const district = ['CW', 'EN', 'SN', 'WCH', 'KC', 'KT', 'SSP', 'WTS', 'YTM'];


    let startDateString = today.toISOString().split('T')[0];
    let districtString = randomSelect(district, 4).join(',');
    let type = randomSelect(Object.keys(typeCode), 1)[0];
    let typeNameString = typeCode[type];
    let typeCodeString = type;
    return `https://www.smartplay.lcsd.gov.hk/facilities/search-result?keywords=&district=${districtString}&startDate=${startDateString}&typeCode=${typeCodeString}&sportCode=BAGM&typeName=${typeNameString}&isFree=false`;
}

function randomSelect(array, count) {
    return array.sort(() => Math.random() - 0.5).slice(0, count);
}

// let test = generateUrl();
// console.log(test);

module.exports = { generateUrl };